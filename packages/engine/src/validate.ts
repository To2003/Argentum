import { tileAt, isOwnable } from '@gran-negocio/shared';
import type {
  Action,
  ActionType,
  ErrorCode,
  PhaseKind,
  PlayerId,
  ReadonlyGameState,
} from './types.js';

/**
 * La tabla de transiciones (ADR 0004): qué acciones existen en cada fase. Es
 * la única fuente de verdad; `legal.ts` y el diagrama `docs/turn-fsm.mmd` se
 * derivan de ella (un test chequea que coincidan).
 */
export const PHASE_ACTIONS: Readonly<Record<PhaseKind, readonly ActionType[]>> = {
  waitingRoll: ['rollDice'],
  jailDecision: ['rollDice', 'payJailFine', 'useJailCard'],
  awaitingPurchase: ['buyProperty', 'declineProperty'],
  postRoll: ['endTurn'],
  inDebt: ['declareBankruptcy'],
  gameOver: [],
};

/**
 * Quién tiene que actuar. En `inDebt` es el primer deudor de la cola, que
 * puede no ser el jugador del turno (cumpleaños, SPEC.md §15.4).
 */
export function actorOf(state: ReadonlyGameState): PlayerId | null {
  switch (state.phase.kind) {
    case 'gameOver':
      return null;
    case 'inDebt':
      return state.phase.debts[0]?.debtorId ?? null;
    default:
      return state.currentPlayerId;
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
  const player = state.players[playerId];
  if (player === undefined) return 'UNKNOWN_PLAYER';
  if (actorOf(state) !== playerId) return 'NOT_YOUR_TURN';
  if (!PHASE_ACTIONS[state.phase.kind].includes(action.type)) return 'WRONG_PHASE';

  switch (action.type) {
    case 'payJailFine':
      return player.cash >= state.rules.jailFine ? null : 'INSUFFICIENT_FUNDS';
    case 'useJailCard':
      return player.jailFreeCards.length > 0 ? null : 'NO_JAIL_CARD';
    case 'buyProperty': {
      if (state.phase.kind !== 'awaitingPurchase') return 'WRONG_PHASE';
      const tile = tileAt(state.phase.tile);
      if (!isOwnable(tile)) return 'WRONG_PHASE';
      return player.cash >= tile.price ? null : 'INSUFFICIENT_FUNDS';
    }
    case 'rollDice':
    case 'declineProperty':
    case 'endTurn':
    case 'declareBankruptcy':
      return null;
  }
}

export const isLegalAction = (
  state: ReadonlyGameState,
  playerId: PlayerId,
  action: Action,
): boolean => validateAction(state, playerId, action) === null;
