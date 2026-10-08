import { COLOR_GROUPS, isOwnable, tileAt } from '@gran-negocio/shared';
import { minBidFor } from './rules/auction.js';
import {
  buildError,
  groupHasBuildings,
  mortgageError,
  ownsWholeGroup,
  sellError,
  unmortgageError,
} from './rules/checks.js';
import { mortgageLiftCost } from './rules/mortgage.js';
import { tradeContentError } from './rules/trade.js';
import type {
  Action,
  ActionType,
  ErrorCode,
  PhaseKind,
  PlayerId,
  ReadonlyGameState,
} from './types.js';

/** El actor del server para acciones sin jugador (fin de partida por tiempo). */
export const SYSTEM_ACTOR = 'system';

/** Construir, vender, hipotecar y levantar hipotecas: la "fase libre" de §5.2. */
const MANAGEMENT: readonly ActionType[] = [
  'buildHouse',
  'sellBuilding',
  'sellAllBuildings',
  'mortgage',
  'unmortgage',
];

/** Lo que sirve para juntar plata (no gastarla). */
const RAISE_CASH: readonly ActionType[] = ['sellBuilding', 'sellAllBuildings', 'mortgage'];

/**
 * La tabla de transiciones (ADR 0004): qué acciones existen en cada fase para
 * quien tiene que actuar en ella. Es la única fuente de verdad; `legal.ts` y
 * el diagrama `docs/turn-fsm.mmd` se derivan de ella (un test lo chequea).
 */
export const PHASE_ACTIONS: Readonly<Record<PhaseKind, readonly ActionType[]>> = {
  waitingRoll: ['rollDice', ...MANAGEMENT, 'proposeTrade'],
  jailDecision: ['rollDice', 'payJailFine', 'useJailCard', ...MANAGEMENT, 'proposeTrade'],
  // Se puede juntar plata para comprar antes de decidir (SPEC.md §15.4 #11).
  awaitingPurchase: ['buyProperty', 'declineProperty', ...RAISE_CASH],
  postRoll: ['endTurn', ...MANAGEMENT, 'proposeTrade'],
  inDebt: ['payDebt', 'declareBankruptcy', ...RAISE_CASH, 'proposeTrade'],
  auction: ['bid', 'passAuction'],
  gameOver: [],
};

/**
 * Respuestas a un trueque abierto: no dependen del turno (el trueque es estado
 * superpuesto), pero no durante una subasta ni con la partida terminada.
 */
export const TRADE_RESPONSES: readonly ActionType[] = [
  'acceptTrade',
  'rejectTrade',
  'counterTrade',
  'cancelTrade',
];

/**
 * Quién tiene que actuar en la fase. En `inDebt` es el primer deudor de la
 * cola, que puede no ser el jugador del turno (SPEC.md §15.4). En `auction`
 * no hay uno solo: pujan todos los participantes (ver `actorsOf`).
 */
export function actorOf(state: ReadonlyGameState): PlayerId | null {
  switch (state.phase.kind) {
    case 'gameOver':
    case 'auction':
      return null;
    case 'inDebt':
      return state.phase.debts[0]?.debtorId ?? null;
    default:
      return state.currentPlayerId;
  }
}

/** Todos los que pueden hacer algo ahora (para timers del server, bots y la UI). */
export function actorsOf(state: ReadonlyGameState): PlayerId[] {
  const actors = new Set<PlayerId>();
  if (state.phase.kind === 'auction') state.phase.participants.forEach((id) => actors.add(id));
  const actor = actorOf(state);
  if (actor !== null) actors.add(actor);
  if (state.trade !== null && state.phase.kind !== 'auction' && state.phase.kind !== 'gameOver') {
    actors.add(state.trade.to);
    actors.add(state.trade.from);
  }
  return [...actors];
}

function validateTradeResponse(
  state: ReadonlyGameState,
  playerId: PlayerId,
  action: Action,
): ErrorCode | null {
  const { trade } = state;
  if (trade === null) return 'NO_TRADE';
  if (action.type === 'cancelTrade') return trade.from === playerId ? null : 'NOT_YOUR_TURN';
  if (trade.to !== playerId) return 'NOT_YOUR_TURN';
  if (state.phase.kind === 'auction') return 'WRONG_PHASE';
  switch (action.type) {
    case 'acceptTrade':
      // Revalida: desde la propuesta pudo cambiar algo (construyó, hipotecó, gastó).
      return tradeContentError(state, trade.from, trade.to, trade.offer, trade.request);
    case 'counterTrade':
      return tradeContentError(state, trade.to, trade.from, action.offer, action.request);
    default:
      return null;
  }
}

/**
 * Valida una acción. Toda la validación está acá y en ningún otro lado: los
 * handlers del reducer asumen que lo que les llega es legal. Devuelve null si
 * se puede aplicar.
 */
export function validateAction(
  state: ReadonlyGameState,
  playerId: PlayerId,
  action: Action,
): ErrorCode | null {
  if (state.phase.kind === 'gameOver') return 'GAME_OVER';

  if (action.type === 'timeUp') {
    if (playerId !== SYSTEM_ACTOR) return 'NOT_YOUR_TURN';
    return state.rules.gameDurationMinutes === null ? 'WRONG_PHASE' : null;
  }

  const player = state.players[playerId];
  if (player === undefined) return 'UNKNOWN_PLAYER';
  if (player.bankrupt) return 'NOT_YOUR_TURN';

  if (TRADE_RESPONSES.includes(action.type)) return validateTradeResponse(state, playerId, action);

  const { phase } = state;
  const isActor =
    phase.kind === 'auction' ? phase.participants.includes(playerId) : actorOf(state) === playerId;
  if (!isActor) return 'NOT_YOUR_TURN';
  if (!PHASE_ACTIONS[phase.kind].includes(action.type)) return 'WRONG_PHASE';

  switch (action.type) {
    case 'payJailFine':
      return player.cash >= state.rules.jailFine ? null : 'INSUFFICIENT_FUNDS';
    case 'useJailCard':
      return player.jailFreeCards.length > 0 ? null : 'NO_JAIL_CARD';
    case 'buyProperty': {
      if (phase.kind !== 'awaitingPurchase') return 'WRONG_PHASE';
      const tile = tileAt(phase.tile);
      if (!isOwnable(tile)) return 'WRONG_PHASE';
      return player.cash >= tile.price ? null : 'INSUFFICIENT_FUNDS';
    }
    case 'payDebt': {
      const debt = phase.kind === 'inDebt' ? phase.debts[0] : undefined;
      if (debt === undefined) return 'WRONG_PHASE';
      return player.cash >= debt.amount ? null : 'DEBT_NOT_COVERED';
    }
    case 'bid': {
      const min = minBidFor(state, playerId);
      if (min === null) return 'WRONG_PHASE';
      if (!Number.isInteger(action.amount) || action.amount < min) return 'BID_TOO_LOW';
      return action.amount <= player.cash ? null : 'INSUFFICIENT_FUNDS';
    }
    case 'passAuction':
      return phase.kind === 'auction' && phase.highBidder === playerId
        ? 'HIGH_BIDDER_CANNOT_PASS'
        : null;
    case 'buildHouse':
      return buildError(state, playerId, action.tile);
    case 'sellBuilding':
      return sellError(state, playerId, action.tile);
    case 'sellAllBuildings':
      if (!COLOR_GROUPS.includes(action.group)) return 'INVALID_TILE';
      if (!ownsWholeGroup(state, playerId, action.group)) return 'NOT_OWNER';
      return groupHasBuildings(state, action.group) ? null : 'MAX_BUILDINGS';
    case 'mortgage':
      return mortgageError(state, playerId, action.tile);
    case 'unmortgage':
      return unmortgageError(state, playerId, action.tile, mortgageLiftCost);
    case 'proposeTrade':
      if (state.trade !== null) return 'TRADE_OPEN';
      return tradeContentError(state, playerId, action.to, action.offer, action.request);
    case 'rollDice':
    case 'declineProperty':
    case 'endTurn':
    case 'declareBankruptcy':
      return null;
    // Resueltas antes del switch.
    case 'acceptTrade':
    case 'rejectTrade':
    case 'counterTrade':
    case 'cancelTrade':
      return 'WRONG_PHASE';
  }
}

export const isLegalAction = (
  state: ReadonlyGameState,
  playerId: PlayerId,
  action: Action,
): boolean => validateAction(state, playerId, action) === null;
