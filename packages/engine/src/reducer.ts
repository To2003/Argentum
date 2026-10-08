import { createCtx, cloneState, playerOf, type Ctx } from './context.js';
import type { GameEvent } from './events.js';
import { goBankrupt } from './rules/debt.js';
import { rollToMove } from './rules/dice.js';
import { leaveAfterForcedFine, payJailFine, rollInJail, useJailCard } from './rules/jail.js';
import { buyProperty, declineProperty } from './rules/purchase.js';
import { checkGameOver, endTurn } from './rules/turn.js';
import type {
  Action,
  ErrorCode,
  GameState,
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
      if (action.type === 'buyProperty') buyProperty(ctx, playerId, tile);
      else declineProperty(ctx, playerId, tile);
      settle(ctx, { kind: 'finishResolution' });
      break;
    }
    case 'endTurn':
      endTurn(ctx);
      break;
    case 'declareBankruptcy':
      declareBankruptcy(ctx);
      break;
  }

  s.version += 1;
  return { ok: true, state: s, events: ctx.events };
}

/**
 * Convierte lo que quedó pendiente en la fase siguiente: deudas → inDebt,
 * propiedad sin dueño → awaitingPurchase, y si no, terminar la resolución.
 */
function settle(ctx: Ctx, returnTo: ResumePoint): void {
  if (ctx.debts.length > 0) {
    if (ctx.pendingPurchase !== null) throw new Error('deuda y compra a la vez');
    ctx.s.phase = { kind: 'inDebt', debts: [...ctx.debts], returnTo };
    return;
  }
  if (ctx.pendingPurchase !== null) {
    ctx.s.phase = { kind: 'awaitingPurchase', tile: ctx.pendingPurchase };
    return;
  }
  finishResolution(ctx);
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

function declareBankruptcy(ctx: Ctx): void {
  const { s } = ctx;
  if (s.phase.kind !== 'inDebt') throw new Error('validate dejó pasar una quiebra');
  const { debts, returnTo } = s.phase;
  const [debt, ...rest] = debts;
  if (debt === undefined) throw new Error('inDebt sin deudas');

  goBankrupt(ctx, debt.debtorId, debt.creditor);
  // El resto de lo que debía el quebrado se pierde: su patrimonio fue al
  // primer acreedor (SPEC.md §15.4).
  const remaining = rest.filter((other) => other.debtorId !== debt.debtorId);
  if (checkGameOver(ctx)) return;
  if (remaining.length > 0) {
    s.phase = { kind: 'inDebt', debts: remaining, returnTo };
    return;
  }
  resume(ctx, returnTo);
}

function resume(ctx: Ctx, point: ResumePoint): void {
  const { s } = ctx;
  if (point.kind === 'moveAfterJailFine' && !playerOf(s, s.currentPlayerId).bankrupt) {
    leaveAfterForcedFine(ctx, s.currentPlayerId, point.dice);
    settle(ctx, { kind: 'finishResolution' });
    return;
  }
  finishResolution(ctx);
}
