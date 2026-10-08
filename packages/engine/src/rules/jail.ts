import type { Ctx } from '../context.js';
import { playerOf } from '../context.js';
import type { Dice } from '../rng.js';
import type { PlayerId } from '../types.js';
import { returnJailCard } from './cards.js';
import { isDoubles, moveWithDice, roll } from './dice.js';
import { bankOrPot, charge, transfer } from './money.js';

function release(ctx: Ctx, playerId: PlayerId): void {
  const player = playerOf(ctx.s, playerId);
  player.inJail = false;
  player.jailAttempts = 0;
}

/** Paga la fianza al inicio del turno; después tira normal (con dobles incluidos). */
export function payJailFine(ctx: Ctx, playerId: PlayerId): void {
  transfer(ctx, playerId, bankOrPot(ctx, 'jailFine'), ctx.s.rules.jailFine, 'jailFine');
  release(ctx, playerId);
  ctx.events.push({ type: 'leftJail', playerId, method: 'fine' });
  ctx.s.phase = { kind: 'waitingRoll' };
}

/** Usa la primera "Salí gratis" que tenga; vuelve al fondo de su mazo. */
export function useJailCard(ctx: Ctx, playerId: PlayerId): void {
  const player = playerOf(ctx.s, playerId);
  const cardId = player.jailFreeCards.shift();
  if (cardId === undefined) throw new Error(`${playerId} no tiene carta`);
  returnJailCard(ctx, cardId);
  release(ctx, playerId);
  ctx.events.push({ type: 'leftJail', playerId, method: 'card', cardId });
  ctx.s.phase = { kind: 'waitingRoll' };
}

/** Lo que pasó al tirar por dobles en la cárcel. */
export type JailRollOutcome =
  | { readonly kind: 'done' }
  /** Tercer intento sin plata para la fianza: hay deuda y después se mueve con estos dados. */
  | { readonly kind: 'owesFine'; readonly dice: Dice };

/**
 * Tira por dobles (SPEC.md §5.3). Dobles: sale y mueve, sin volver a tirar.
 * Si falla el intento número `maxJailTurns`, paga la fianza obligatoria y mueve
 * con esa tirada. Si no, queda preso y el turno pasa a postRoll.
 */
export function rollInJail(ctx: Ctx, playerId: PlayerId): JailRollOutcome {
  const dice = roll(ctx, playerId, 'jail');
  const player = playerOf(ctx.s, playerId);
  ctx.s.turn.rollAgain = false;

  if (isDoubles(dice)) {
    release(ctx, playerId);
    ctx.events.push({ type: 'leftJail', playerId, method: 'doubles' });
    moveWithDice(ctx, playerId, dice);
    return { kind: 'done' };
  }

  player.jailAttempts += 1;
  ctx.events.push({ type: 'jailRollFailed', playerId, attempt: player.jailAttempts });
  if (player.jailAttempts < ctx.s.rules.maxJailTurns) return { kind: 'done' };

  const paid = charge(ctx, playerId, bankOrPot(ctx, 'jailFine'), ctx.s.rules.jailFine, 'jailFine');
  if (!paid) return { kind: 'owesFine', dice };
  leaveAfterForcedFine(ctx, playerId, dice);
  return { kind: 'done' };
}

/** Con la fianza obligatoria paga, sale y mueve con la tirada del tercer intento. */
export function leaveAfterForcedFine(ctx: Ctx, playerId: PlayerId, dice: Dice): void {
  release(ctx, playerId);
  ctx.events.push({ type: 'leftJail', playerId, method: 'forcedFine' });
  moveWithDice(ctx, playerId, dice);
}
