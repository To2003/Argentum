import { tileAt } from '@gran-negocio/shared';
import type { Ctx } from '../context.js';
import { playerOf } from '../context.js';
import { rollDice, type Dice } from '../rng.js';
import type { PlayerId } from '../types.js';
import { applyCard, drawCard } from './cards.js';
import { bankOrPot, charge, transfer } from './money.js';
import { sendToJail } from './movement.js';
import { rentFor, type NearestModifier } from './rent.js';

/**
 * Cuántas casillas se pueden encadenar en una resolución. Hoy el máximo real
 * es 2 (Suerte → Retrocedé 3 → Barrio → carta); si alguna vez se arma un
 * ciclo entre cartas, esto corta con un error en vez de colgar el server.
 */
export const MAX_RESOLUTION_DEPTH = 4;

/** Tira los dados por fuera del movimiento (la carta de servicio): no toca los dobles. */
function rollForUtilityCard(ctx: Ctx, playerId: PlayerId): Dice {
  const draw = rollDice(ctx.s.rngState);
  ctx.s.rngState = draw.state;
  ctx.events.push({ type: 'diceRolled', playerId, dice: draw.value, reason: 'utilityCard' });
  return draw.value;
}

/**
 * Resuelve la casilla donde quedó el jugador. Lo que necesita una decisión
 * (comprar) o no se pudo pagar (deudas) queda anotado en `ctx` para el reducer.
 */
export function resolveTile(
  ctx: Ctx,
  playerId: PlayerId,
  dice: Dice | null,
  modifier?: NearestModifier,
  depth = 0,
): void {
  if (depth > MAX_RESOLUTION_DEPTH) {
    throw new Error(`resolución encadenada de más de ${MAX_RESOLUTION_DEPTH} casillas`);
  }
  const player = playerOf(ctx.s, playerId);
  const index = player.position;
  const tile = tileAt(index);
  ctx.events.push({ type: 'landed', playerId, tile: index });

  switch (tile.kind) {
    case 'property':
    case 'subway':
    case 'utility': {
      const owned = ctx.s.properties[index];
      if (owned === undefined) {
        ctx.pendingPurchase = index;
        ctx.events.push({ type: 'purchaseOffered', playerId, tile: index });
        return;
      }
      if (owned.ownerId === playerId || owned.mortgaged) return;
      let total = (dice ?? ctx.s.turn.lastRoll ?? [0, 0]).reduce((a, b) => a + b, 0);
      if (tile.kind === 'utility' && modifier?.target === 'utility') {
        const reroll = rollForUtilityCard(ctx, playerId);
        total = reroll[0] + reroll[1];
      }
      const rent = rentFor(ctx.s, index, total, modifier);
      charge(ctx, playerId, owned.ownerId, rent, 'rent', index);
      return;
    }
    case 'tax':
      charge(ctx, playerId, bankOrPot(ctx, 'tax'), tile.amount, 'tax', index);
      return;
    case 'chance':
    case 'community': {
      const card = drawCard(ctx, playerId, tile.kind);
      const outcome = applyCard(ctx, playerId, card);
      if (outcome.kind === 'resolveTile') {
        resolveTile(ctx, playerId, null, outcome.modifier, depth + 1);
      }
      return;
    }
    case 'freeRest':
      if (ctx.s.pot > 0) transfer(ctx, 'pot', playerId, ctx.s.pot, 'pot', index);
      return;
    case 'goToJail':
      sendToJail(ctx, playerId, 'tile');
      return;
    case 'go':
    case 'jail':
      return;
  }
}
