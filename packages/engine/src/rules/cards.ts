import {
  cardById,
  SUBWAY_TILES,
  UTILITY_TILES,
  type Card,
  type DeckKind,
} from '@gran-negocio/shared';
import type { Ctx } from '../context.js';
import { othersInTurnOrder, playerOf } from '../context.js';
import type { CardId, PlayerId } from '../types.js';
import { bankOrPot, charge, transfer } from './money.js';
import { advanceTo, moveBySteps, nearestAhead, sendToJail } from './movement.js';
import type { NearestModifier } from './rent.js';

export const deckOf = (cardId: CardId): DeckKind =>
  cardId.startsWith('chance.') ? 'chance' : 'community';

/**
 * Roba la carta de arriba. La que no es "Salí gratis" vuelve al fondo en el
 * acto; la "Salí gratis" se la queda el jugador hasta usarla (SPEC.md §6).
 */
export function drawCard(ctx: Ctx, playerId: PlayerId, deck: DeckKind): Card {
  const cardId = ctx.s.decks[deck].shift();
  if (cardId === undefined) throw new Error(`mazo ${deck} vacío`);
  const card = cardById(cardId);
  ctx.events.push({ type: 'cardDrawn', playerId, deck, cardId });
  if (card.effect.type === 'jailFreeCard') {
    playerOf(ctx.s, playerId).jailFreeCards.push(cardId);
    ctx.events.push({ type: 'jailFreeCardKept', playerId, cardId });
  } else {
    ctx.s.decks[deck].push(cardId);
  }
  return card;
}

/** Devuelve una "Salí gratis" al fondo de su mazo. */
export function returnJailCard(ctx: Ctx, cardId: CardId): void {
  ctx.s.decks[deckOf(cardId)].push(cardId);
}

/** Qué hay que resolver después de aplicar la carta. */
export type CardOutcome =
  { readonly kind: 'done' } | { readonly kind: 'resolveTile'; readonly modifier?: NearestModifier };

/** Aplica el efecto. Si movió al jugador, quien llama resuelve la casilla nueva. */
export function applyCard(ctx: Ctx, playerId: PlayerId, card: Card): CardOutcome {
  const { effect } = card;
  const player = playerOf(ctx.s, playerId);
  switch (effect.type) {
    case 'moveTo':
      advanceTo(ctx, playerId, effect.tile);
      return { kind: 'resolveTile' };
    case 'moveToNearest': {
      const targets = effect.target === 'subway' ? SUBWAY_TILES : UTILITY_TILES;
      advanceTo(ctx, playerId, nearestAhead(player.position, targets));
      return {
        kind: 'resolveTile',
        modifier:
          effect.target === 'subway'
            ? { target: 'subway', rentMultiplier: effect.rentMultiplier }
            : { target: 'utility', diceMultiplier: effect.diceMultiplier },
      };
    }
    case 'moveRelative':
      moveBySteps(ctx, playerId, effect.steps, 'card');
      return { kind: 'resolveTile' };
    case 'gain':
      transfer(ctx, 'bank', playerId, effect.amount, 'card');
      return { kind: 'done' };
    case 'pay':
      charge(ctx, playerId, bankOrPot(ctx, 'card'), effect.amount, 'card');
      return { kind: 'done' };
    case 'gainFromEach':
      for (const other of othersInTurnOrder(ctx.s, playerId)) {
        charge(ctx, other, playerId, effect.amount, 'card');
      }
      return { kind: 'done' };
    case 'payEach':
      for (const other of othersInTurnOrder(ctx.s, playerId)) {
        charge(ctx, playerId, other, effect.amount, 'card');
      }
      return { kind: 'done' };
    case 'repairs': {
      let houses = 0;
      let hotels = 0;
      for (const owned of Object.values(ctx.s.properties)) {
        if (owned.ownerId !== playerId) continue;
        if (owned.houses === 5) hotels += 1;
        else houses += owned.houses;
      }
      const amount = houses * effect.perHouse + hotels * effect.perHotel;
      charge(ctx, playerId, bankOrPot(ctx, 'card'), amount, 'card');
      return { kind: 'done' };
    }
    case 'goToJail':
      sendToJail(ctx, playerId, 'card');
      return { kind: 'done' };
    case 'jailFreeCard':
      // Ya quedó en la mano del jugador al robarla.
      return { kind: 'done' };
  }
}
