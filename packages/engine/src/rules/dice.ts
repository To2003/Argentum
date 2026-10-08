import type { Ctx } from '../context.js';
import { rollDice, type Dice } from '../rng.js';
import type { PlayerId } from '../types.js';
import { moveBySteps, sendToJail } from './movement.js';
import { resolveTile } from './tiles.js';

export const isDoubles = (dice: Dice): boolean => dice[0] === dice[1];
export const diceTotal = (dice: Dice): number => dice[0] + dice[1];

/** Tira con el PRNG del estado y deja la tirada como `lastRoll`. */
export function roll(ctx: Ctx, playerId: PlayerId, reason: 'move' | 'jail'): Dice {
  const draw = rollDice(ctx.s.rngState);
  ctx.s.rngState = draw.state;
  ctx.s.turn.lastRoll = draw.value;
  ctx.events.push({ type: 'diceRolled', playerId, dice: draw.value, reason });
  return draw.value;
}

/** Mueve con una tirada y resuelve la casilla. */
export function moveWithDice(ctx: Ctx, playerId: PlayerId, dice: Dice): void {
  moveBySteps(ctx, playerId, diceTotal(dice), 'dice');
  resolveTile(ctx, playerId, dice);
}

/**
 * La tirada normal del turno. Con dobles vuelve a tirar; el tercer doble
 * seguido manda a la cárcel sin mover (SPEC.md §5.2).
 */
export function rollToMove(ctx: Ctx, playerId: PlayerId): void {
  const dice = roll(ctx, playerId, 'move');
  const { turn } = ctx.s;
  if (isDoubles(dice)) {
    turn.doublesCount += 1;
    if (turn.doublesCount === 3) {
      sendToJail(ctx, playerId, 'threeDoubles');
      return;
    }
    turn.rollAgain = true;
  } else {
    turn.rollAgain = false;
  }
  // Si la casilla lo manda preso, sendToJail apaga rollAgain.
  moveWithDice(ctx, playerId, dice);
}
