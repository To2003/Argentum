import { createCtx, cloneState, playerOf, type Ctx } from './context.js';
import type { GameEvent } from './events.js';
import {
  closeAuction,
  isDecided,
  openPropertyAuction,
  passAuction,
  placeBid,
} from './rules/auction.js';
import { buildHouse, placeBuilding, sellAllBuildings, sellBuilding } from './rules/build.js';
import { goBankrupt, payDebt } from './rules/debt.js';
import { rollToMove } from './rules/dice.js';
import { endGame } from './rules/endgame.js';
import { leaveAfterForcedFine, payJailFine, rollInJail, useJailCard } from './rules/jail.js';
import { mortgageProperty, unmortgageProperty } from './rules/mortgage.js';
import { buyProperty, declineProperty } from './rules/purchase.js';
import { acceptTrade, closeTrade, proposeTrade } from './rules/trade.js';
import { checkGameOver, endTurn } from './rules/turn.js';
import type {
  Action,
  Debt,
  ErrorCode,
  GameState,
  Phase,
  PlayerId,
  ReadonlyGameState,
  ResumePoint,
} from './types.js';
import { validateAction } from './validate.js';

/**
 * La puerta de entrada del engine (SPEC.md §3.1).
 *
 * Pura: nunca toca el estado que recibe. Valida una sola vez, acá, antes de
 * clonar; una acción rechazada devuelve el error y nada más (ni clona ni
 * consume RNG, de eso depende el replay). Si se aplica, trabaja sobre un clon
 * y devuelve el estado nuevo con `version + 1`.
 */
export type ApplyResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: ErrorCode };

export function applyAction(
  state: ReadonlyGameState,
  playerId: PlayerId,
  action: Action,
): ApplyResult {
  const error = validateAction(state, playerId, action);
  if (error !== null) return { ok: false, error };

  const ctx = createCtx(cloneState(state) as GameState);
  const { s } = ctx;
  const here: ResumePoint = { kind: 'restorePhase', phase: s.phase };

  switch (action.type) {
    case 'rollDice':
      if (s.phase.kind === 'jailDecision') {
        const outcome = rollInJail(ctx, playerId);
        settle(
          ctx,
          outcome.kind === 'owesFine'
            ? { kind: 'moveAfterJailFine', dice: outcome.dice }
            : { kind: 'finishResolution' },
        );
      } else {
        rollToMove(ctx, playerId);
        settle(ctx, { kind: 'finishResolution' });
      }
      break;
    case 'payJailFine':
      payJailFine(ctx, playerId);
      break;
    case 'useJailCard':
      useJailCard(ctx, playerId);
      break;
    case 'buyProperty':
    case 'declineProperty': {
      if (s.phase.kind !== 'awaitingPurchase') throw new Error('validate dejó pasar una compra');
      const { tile } = s.phase;
      if (action.type === 'buyProperty') {
        buyProperty(ctx, playerId, tile);
        settle(ctx, { kind: 'finishResolution' });
      } else if (!declineProperty(ctx, playerId, tile)) {
        settle(ctx, { kind: 'finishResolution' });
      }
      break;
    }
    case 'endTurn':
      endTurn(ctx);
      break;
    case 'declareBankruptcy':
      declareBankruptcy(ctx);
      break;
    case 'payDebt': {
      if (s.phase.kind !== 'inDebt') throw new Error('validate dejó pasar un pago');
      const [debt, ...rest] = s.phase.debts;
      if (debt === undefined) throw new Error('inDebt sin deudas');
      payDebt(ctx, debt);
      continueDebts(ctx, rest, s.phase.returnTo);
      break;
    }
    case 'bid':
      placeBid(ctx, playerId, action.amount);
      if (s.phase.kind === 'auction' && isDecided(s.phase)) finishAuction(ctx);
      break;
    case 'passAuction':
      if (passAuction(ctx, playerId)) finishAuction(ctx);
      break;
    case 'buildHouse':
      buildHouse(ctx, playerId, action.tile, here);
      break;
    case 'sellBuilding':
      sellBuilding(ctx, playerId, action.tile);
      break;
    case 'sellAllBuildings':
      sellAllBuildings(ctx, playerId, action.group);
      break;
    case 'mortgage':
      mortgageProperty(ctx, playerId, action.tile);
      break;
    case 'unmortgage':
      unmortgageProperty(ctx, playerId, action.tile);
      break;
    case 'proposeTrade':
      proposeTrade(ctx, playerId, action.to, action.offer, action.request, false);
      break;
    case 'counterTrade': {
      const previous = s.trade;
      if (previous === null) throw new Error('validate dejó pasar una contraoferta');
      closeTrade(ctx, 'rejected');
      proposeTrade(ctx, previous.to, previous.from, action.offer, action.request, true);
      break;
    }
    case 'acceptTrade':
      acceptTrade(ctx);
      break;
    case 'rejectTrade':
      closeTrade(ctx, 'rejected');
      break;
    case 'cancelTrade':
      closeTrade(ctx, 'cancelled');
      break;
    case 'timeUp':
      endGame(ctx, 'time');
      break;
  }

  s.version += 1;
  return { ok: true, state: s, events: ctx.events };
}

/**
 * Convierte lo que quedó pendiente en la fase siguiente: deudas → inDebt,
 * propiedad sin dueño → awaitingPurchase, y si no, retomar `returnTo`.
 */
function settle(ctx: Ctx, returnTo: ResumePoint): void {
  if (ctx.debts.length > 0) {
    if (ctx.pendingPurchase !== null) throw new Error('deuda y compra a la vez');
    ctx.s.phase = { kind: 'inDebt', debts: ctx.debts.splice(0), returnTo };
    return;
  }
  if (ctx.pendingPurchase !== null) {
    ctx.s.phase = { kind: 'awaitingPurchase', tile: ctx.pendingPurchase };
    return;
  }
  resume(ctx, returnTo);
}

/** Después de resolver: otra tirada si hubo dobles, si no postRoll; si quebró, pasa el turno. */
function finishResolution(ctx: Ctx): void {
  if (checkGameOver(ctx)) return;
  const { s } = ctx;
  if (playerOf(s, s.currentPlayerId).bankrupt) {
    endTurn(ctx);
    return;
  }
  s.phase = s.turn.rollAgain ? { kind: 'waitingRoll' } : { kind: 'postRoll' };
}

/** Sigue con la cola de deudas, o retoma cuando no queda ninguna. */
function continueDebts(ctx: Ctx, debts: readonly Debt[], returnTo: ResumePoint): void {
  const pending = debts.filter((debt) => !playerOf(ctx.s, debt.debtorId).bankrupt);
  if (pending.length > 0) {
    ctx.s.phase = { kind: 'inDebt', debts: pending, returnTo };
    return;
  }
  resume(ctx, returnTo);
}

function declareBankruptcy(ctx: Ctx): void {
  const { s } = ctx;
  if (s.phase.kind !== 'inDebt') throw new Error('validate dejó pasar una quiebra');
  const { debts, returnTo } = s.phase;
  const [debt, ...rest] = debts;
  if (debt === undefined) throw new Error('inDebt sin deudas');

  const toAuction = goBankrupt(ctx, debt.debtorId, debt.creditor);
  if (checkGameOver(ctx)) return;
  // Si quebró el jugador del turno, su turno termina acá: las subastas y las
  // deudas que queden se resuelven ya en el turno del siguiente, que retoma
  // su fase inicial después (así el jugador del turno nunca es un quebrado).
  let base = returnTo;
  if (debt.debtorId === s.currentPlayerId) {
    endTurn(ctx);
    // endTurn puede terminar la partida (límite de rondas).
    const next = currentPhase(ctx);
    if (next.kind === 'gameOver') return;
    base = { kind: 'restorePhase', phase: next };
  }
  // El resto de lo que debía el quebrado se pierde: su patrimonio fue al
  // primer acreedor (SPEC.md §15.4). Lo que le debían a él pasa a ser deuda
  // con el banco. Al final, las deudas nuevas (el 10 % de las hipotecadas que
  // recibió el acreedor).
  const remaining: Debt[] = [
    ...rest
      .filter((other) => other.debtorId !== debt.debtorId)
      .map((other) =>
        other.creditor === debt.debtorId ? { ...other, creditor: 'bank' as const } : other,
      ),
    ...ctx.debts.splice(0),
  ];
  const after: ResumePoint =
    remaining.length > 0
      ? { kind: 'restorePhase', phase: { kind: 'inDebt', debts: remaining, returnTo: base } }
      : base;
  const [first, ...queue] = toAuction;
  if (first !== undefined) {
    openPropertyAuction(ctx, first, queue, after);
    return;
  }
  resume(ctx, after);
}

/** La fase actual sin el estrechamiento de tipos de TS (otras funciones la cambian). */
const currentPhase = (ctx: Ctx): Phase => ctx.s.phase;

function finishAuction(ctx: Ctx): void {
  const { next, queue, returnTo } = closeAuction(ctx, (winner, tile) => {
    placeBuilding(ctx, winner, tile);
  });
  if (next !== null) {
    openPropertyAuction(ctx, next, queue, returnTo);
    return;
  }
  resume(ctx, returnTo);
}

function resume(ctx: Ctx, point: ResumePoint): void {
  const { s } = ctx;
  if (checkGameOver(ctx)) return;
  switch (point.kind) {
    case 'finishResolution':
      finishResolution(ctx);
      return;
    case 'moveAfterJailFine':
      // Solo se llega con la fianza paga: si el jugador del turno hubiera
      // quebrado, declareBankruptcy ya le habría terminado el turno.
      leaveAfterForcedFine(ctx, s.currentPlayerId, point.dice);
      settle(ctx, { kind: 'finishResolution' });
      return;
    case 'restorePhase':
      if (point.phase.kind === 'inDebt') {
        continueDebts(ctx, point.phase.debts, point.phase.returnTo);
        return;
      }
      s.phase = point.phase;
      return;
  }
}
