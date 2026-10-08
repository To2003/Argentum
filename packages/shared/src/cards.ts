import cardsJson from '../data/cards.json' with { type: 'json' };
import type { z } from 'zod';
import type { CardEffectSchema, CardSchema } from './schemas/cards.js';

export type Card = z.infer<typeof CardSchema>;
export type CardEffect = z.infer<typeof CardEffectSchema>;
export type CardEffectType = CardEffect['type'];
export type DeckKind = 'chance' | 'community';

/** Validado por los tests y por `validateGameData` (ver board.ts): el cast es seguro. */
const parsed = cardsJson as unknown as Record<DeckKind, Card[]>;

/** Los dos mazos en el orden del SPEC, sin barajar. El engine los baraja con el PRNG. */
export const DECKS: Readonly<Record<DeckKind, readonly Card[]>> = Object.freeze({
  chance: Object.freeze(parsed.chance),
  community: Object.freeze(parsed.community),
});

const byId = new Map<string, Card>(
  [...DECKS.chance, ...DECKS.community].map((card) => [card.id, card]),
);

/** Una carta por id. Un id desconocido es un bug de quien llama. */
export function cardById(id: string): Card {
  const card = byId.get(id);
  if (card === undefined) throw new RangeError(`no hay carta ${id}`);
  return card;
}
