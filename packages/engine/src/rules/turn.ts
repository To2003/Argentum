import type { Ctx } from '../context.js';
import { activePlayers, playerOf } from '../context.js';
import { endGame } from './endgame.js';

/** Si queda un solo jugador activo (o ya terminó), la partida está terminada. */
export function checkGameOver(ctx: Ctx): boolean {
  if (ctx.s.phase.kind === 'gameOver') return true;
  if (activePlayers(ctx.s).length > 1) return false;
  endGame(ctx, 'lastStanding');
  return true;
}

/**
 * Pasa al siguiente jugador activo en el orden de turno. Si el turno da la
 * vuelta empieza una ronda nueva; con `maxRounds`, pasarse termina la partida
 * por patrimonio (SPEC.md §5.8).
 */
export function startNextTurn(ctx: Ctx): void {
  if (checkGameOver(ctx)) return;
  const { s } = ctx;
  const start = s.turnOrder.indexOf(s.currentPlayerId);
  for (let offset = 1; offset <= s.turnOrder.length; offset += 1) {
    const index = (start + offset) % s.turnOrder.length;
    const candidate = s.turnOrder[index];
    if (candidate === undefined || playerOf(s, candidate).bankrupt) continue;
    if (index <= start) {
      s.round += 1;
      ctx.events.push({ type: 'roundStarted', round: s.round });
      if (s.rules.maxRounds !== null && s.round > s.rules.maxRounds) {
        endGame(ctx, 'rounds');
        return;
      }
    }
    startTurn(ctx, candidate);
    return;
  }
  throw new Error('no hay siguiente jugador activo');
}

export function startTurn(ctx: Ctx, playerId: string): void {
  const { s } = ctx;
  s.currentPlayerId = playerId;
  s.turn = { doublesCount: 0, rollAgain: false, lastRoll: null };
  s.phase = playerOf(s, playerId).inJail ? { kind: 'jailDecision' } : { kind: 'waitingRoll' };
  ctx.events.push({ type: 'turnStarted', playerId, turnNumber: s.turnNumber });
}

/** endTurn: cierra el turno del jugador actual y arranca el siguiente. */
export function endTurn(ctx: Ctx): void {
  // Un trueque abierto no sobrevive al turno en que se propuso (SPEC.md §15.5).
  if (ctx.s.trade !== null) {
    ctx.events.push({ type: 'tradeClosed', tradeId: ctx.s.trade.id, reason: 'cancelled' });
    ctx.s.trade = null;
  }
  ctx.events.push({ type: 'turnEnded', playerId: ctx.s.currentPlayerId });
  ctx.s.turnNumber += 1;
  startNextTurn(ctx);
}
