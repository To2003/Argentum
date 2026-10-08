import { z } from 'zod';
import { TILE_COUNT } from '../constants.js';

/** Tamaño de cada mazo (SPEC.md §6). */
export const DECK_SIZE = 16;

const Amount = z.int().positive();

export const CardEffectSchema = z.discriminatedUnion('type', [
  /** Ir a una casilla; si pasa por la Salida, cobra (incluye moveTo(0)). */
  z.strictObject({
    type: z.literal('moveTo'),
    tile: z
      .int()
      .min(0)
      .max(TILE_COUNT - 1),
  }),
  /**
   * Casilla más cercana de un tipo. Servicio: si tiene dueño, se tiran los
   * dados de nuevo y se paga `diceMultiplier` ×. Subte: si tiene dueño, se
   * paga `rentMultiplier` × el alquiler normal.
   */
  z.discriminatedUnion('target', [
    z.strictObject({
      type: z.literal('moveToNearest'),
      target: z.literal('utility'),
      diceMultiplier: Amount,
    }),
    z.strictObject({
      type: z.literal('moveToNearest'),
      target: z.literal('subway'),
      rentMultiplier: Amount,
    }),
  ]),
  /** Moverse `steps` casillas (negativo = hacia atrás, sin cobrar Salida). */
  z.strictObject({
    type: z.literal('moveRelative'),
    steps: z
      .int()
      .min(-(TILE_COUNT - 1))
      .max(TILE_COUNT - 1)
      .refine((steps) => steps !== 0),
  }),
  z.strictObject({ type: z.literal('gain'), amount: Amount }),
  z.strictObject({ type: z.literal('pay'), amount: Amount }),
  /** Cada jugador activo le paga `amount` al que sacó la carta. */
  z.strictObject({ type: z.literal('gainFromEach'), amount: Amount }),
  /** El que sacó la carta le paga `amount` a cada jugador activo. */
  z.strictObject({ type: z.literal('payEach'), amount: Amount }),
  z.strictObject({ type: z.literal('repairs'), perHouse: Amount, perHotel: Amount }),
  z.strictObject({ type: z.literal('goToJail') }),
  /** Se queda en la mano del jugador hasta usarla o venderla; no vuelve al mazo. */
  z.strictObject({ type: z.literal('jailFreeCard') }),
]);

export const CardSchema = z.strictObject({
  /** `<mazo>.<nombre>`: estable, lo usan los logs y los replays. */
  id: z.string().regex(/^(chance|community)\.[a-z][A-Za-z0-9]*$/),
  /** Clave del texto en i18n. Dos copias de la misma carta comparten texto. */
  textKey: z.string().startsWith('card.'),
  effect: CardEffectSchema,
});

const DeckSchema = (deck: 'chance' | 'community') =>
  z
    .array(CardSchema)
    .length(DECK_SIZE)
    .superRefine((cards, ctx) => {
      const ids = new Set<string>();
      cards.forEach((card, position) => {
        if (!card.id.startsWith(`${deck}.`)) {
          ctx.addIssue({
            code: 'custom',
            path: [position, 'id'],
            message: `${card.id} no es del mazo ${deck}`,
          });
        }
        if (ids.has(card.id)) {
          ctx.addIssue({
            code: 'custom',
            path: [position, 'id'],
            message: `id repetido: ${card.id}`,
          });
        }
        ids.add(card.id);
      });
    });

export const DecksSchema = z.strictObject({
  $comment: z.string().optional(),
  chance: DeckSchema('chance'),
  community: DeckSchema('community'),
});
