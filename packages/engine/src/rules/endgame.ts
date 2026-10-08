import type { Ctx } from '../context.js';
import { activePlayers } from '../context.js';
import type { DeepReadonly, GameOverReason, GameState, PlayerId } from '../types.js';
import { HOTEL, ownableAt } from './checks.js';

/**
 * Patrimonio neto (SPEC.md §5.8): efectivo + valor de las propiedades +
 * edificios al costo. Una hipotecada vale su precio menos lo que se debe por
 * ella, es decir, el valor de la hipoteca (SPEC.md §15.5).
 */
export function netWorth(state: DeepReadonly<GameState>, playerId: PlayerId): number {
  let total = state.players[playerId]?.cash ?? 0;
  for (const [key, owned] of Object.entries(state.properties)) {
    if (owned.ownerId !== playerId) continue;
    const tile = ownableAt(Number(key));
    total += owned.mortgaged ? tile.price - tile.mortgage : tile.price;
    if (tile.kind === 'property' && owned.houses > 0) {
      total += (owned.houses === HOTEL ? HOTEL : owned.houses) * tile.houseCost;
    }
  }
  return total;
}

/**
 * Termina la partida. Con `lastStanding` gana el único que queda; con límite de
 * rondas o de tiempo, el de mayor patrimonio. Desempate: más efectivo y,
 * si sigue empatado, el primero en el orden de turno (SPEC.md §15.5).
 */
export function endGame(ctx: Ctx, reason: GameOverReason): void {
  const { s } = ctx;
  const active = activePlayers(s);
  const worth = Object.fromEntries(active.map((id) => [id, netWorth(s, id)]));
  let winnerId: PlayerId | null = null;
  for (const id of active) {
    if (winnerId === null) {
      winnerId = id;
      continue;
    }
    const best = winnerId;
    const better =
      (worth[id] ?? 0) > (worth[best] ?? 0) ||
      ((worth[id] ?? 0) === (worth[best] ?? 0) &&
        (s.players[id]?.cash ?? 0) > (s.players[best]?.cash ?? 0));
    if (better) winnerId = id;
  }
  s.phase = { kind: 'gameOver', winnerId, reason };
  s.trade = null;
  ctx.events.push({ type: 'gameOver', winnerId, reason, netWorth: worth });
}
