import { GO_INDEX, JAIL_INDEX, TILE_COUNT } from '@gran-negocio/shared';
import type { Ctx } from '../context.js';
import { playerOf } from '../context.js';
import type { PlayerId, TileIndex } from '../types.js';
import { transfer } from './money.js';

type Cause = 'dice' | 'card';

const wrap = (index: number): TileIndex => ((index % TILE_COUNT) + TILE_COUNT) % TILE_COUNT;

/** Mueve y emite el evento. Cobra la Salida si pasó o cayó en ella yendo hacia adelante. */
function place(ctx: Ctx, playerId: PlayerId, steps: number, cause: Cause): void {
  const player = playerOf(ctx.s, playerId);
  const from = player.position;
  const to = wrap(from + steps);
  // Hacia atrás nunca se cobra (Retrocedé 3 casillas).
  const passedGo = steps > 0 && from + steps >= TILE_COUNT;
  player.position = to;
  ctx.events.push({ type: 'moved', playerId, from, to, steps, passedGo, cause });
  if (passedGo) transfer(ctx, 'bank', playerId, ctx.s.rules.salary, 'salary', GO_INDEX);
}

/** Avanza (o retrocede, con steps negativos) una cantidad de casillas. */
export function moveBySteps(ctx: Ctx, playerId: PlayerId, steps: number, cause: Cause): void {
  place(ctx, playerId, steps, cause);
}

/** Avanza hasta una casilla, siempre hacia adelante (las cartas "Avanzá hasta…"). */
export function advanceTo(ctx: Ctx, playerId: PlayerId, target: TileIndex): void {
  const from = playerOf(ctx.s, playerId).position;
  const steps = wrap(target - from);
  place(ctx, playerId, steps, 'card');
}

/** La próxima casilla hacia adelante entre `targets` (estrictamente después de `from`). */
export function nearestAhead(from: TileIndex, targets: readonly TileIndex[]): TileIndex {
  let best: TileIndex | null = null;
  let bestDistance = Infinity;
  for (const target of targets) {
    const distance = wrap(target - from) || TILE_COUNT;
    if (distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  if (best === null) throw new Error('nearestAhead sin destinos');
  return best;
}

/** A la cárcel, sin pasar por la Salida. Corta los dobles del turno (SPEC.md §15.4). */
export function sendToJail(
  ctx: Ctx,
  playerId: PlayerId,
  cause: 'tile' | 'card' | 'threeDoubles',
): void {
  const player = playerOf(ctx.s, playerId);
  player.position = JAIL_INDEX;
  player.inJail = true;
  player.jailAttempts = 0;
  ctx.s.turn.rollAgain = false;
  ctx.s.turn.doublesCount = 0;
  ctx.events.push({ type: 'sentToJail', playerId, cause });
}
