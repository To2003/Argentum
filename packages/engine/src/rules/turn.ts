import type { Ctx } from '../context.js';
import { activePlayers, playerOf } from '../context.js';

/** Si queda un solo jugador activo, termina la partida. Devuelve si terminó. */
export function checkGameOver(ctx: Ctx): boolean {
  const active = activePlayers(ctx.s);
  if (active.length > 1) return false;
  const winnerId = active[0] ?? null;
  ctx.s.phase = { kind: 'gameOver', winnerId };
  ctx.events.push({ type: 'gameOver', winnerId });
  return true;
}

/** Pasa al siguiente jugador activo en el orden de turno. */
export function startNextTurn(ctx: Ctx): void {
  if (checkGameOver(ctx)) return;
  const { s } = ctx;
  const start = s.turnOrder.indexOf(s.currentPlayerId);
  for (let offset = 1; offset <= s.turnOrder.length; offset += 1) {
    const candidate = s.turnOrder[(start + offset) % s.turnOrder.length];
    if (candidate !== undefined && !playerOf(s, candidate).bankrupt) {
      startTurn(ctx, candidate);
      return;
    }
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
  ctx.events.push({ type: 'turnEnded', playerId: ctx.s.currentPlayerId });
  ctx.s.turnNumber += 1;
  startNextTurn(ctx);
}
