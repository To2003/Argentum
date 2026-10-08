import { z } from 'zod';
import { COLOR_GROUPS, TILE_COUNT } from '../constants.js';

export const ColorGroupSchema = z.enum(COLOR_GROUPS);

const Money = z.int().nonnegative();
const Price = z.int().positive();

const base = {
  index: z
    .int()
    .min(0)
    .max(TILE_COUNT - 1),
  /** Identificador estable en camelCase: lo usan los logs, los replays y las claves de i18n. */
  id: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
  /** Clave del nombre en i18n. Si `brand` es true, existe además `${nameKey}.generic`. */
  nameKey: z.string().startsWith('tile.'),
  /** Nombre de una empresa real: se reemplaza por el genérico con `useRealBrands = false`. */
  brand: z.literal(true).optional(),
};

const PropertyTileSchema = z.strictObject({
  ...base,
  kind: z.literal('property'),
  group: ColorGroupSchema,
  price: Price,
  mortgage: Price,
  houseCost: Price,
  /** [base, 1 casa, 2, 3, 4, hotel] */
  rent: z.tuple([Money, Money, Money, Money, Money, Money]),
});

const SubwayTileSchema = z.strictObject({
  ...base,
  kind: z.literal('subway'),
  price: Price,
  mortgage: Price,
  /** Según cuántas líneas tenga el dueño: [1, 2, 3, 4]. */
  rent: z.tuple([Money, Money, Money, Money]),
});

const UtilityTileSchema = z.strictObject({
  ...base,
  kind: z.literal('utility'),
  price: Price,
  mortgage: Price,
  /** Multiplicador de los dados según cuántos servicios tenga el dueño: [1, 2]. */
  multipliers: z.tuple([Price, Price]),
});

const TaxTileSchema = z.strictObject({
  ...base,
  kind: z.literal('tax'),
  amount: Price,
});

const simple = (kind: 'go' | 'chance' | 'community' | 'jail' | 'freeRest' | 'goToJail') =>
  z.strictObject({ ...base, kind: z.literal(kind) });

export const TileSchema = z.discriminatedUnion('kind', [
  PropertyTileSchema,
  SubwayTileSchema,
  UtilityTileSchema,
  TaxTileSchema,
  simple('go'),
  simple('chance'),
  simple('community'),
  simple('jail'),
  simple('freeRest'),
  simple('goToJail'),
]);

export const BoardSchema = z
  .strictObject({
    $comment: z.string().optional(),
    tiles: z.array(TileSchema).length(TILE_COUNT),
  })
  .superRefine(({ tiles }, ctx) => {
    tiles.forEach((tile, position) => {
      if (tile.index !== position) {
        ctx.addIssue({
          code: 'custom',
          path: ['tiles', position, 'index'],
          message: `la casilla en la posición ${position} dice ser la ${tile.index}`,
        });
      }
    });
    const ids = new Set<string>();
    for (const tile of tiles) {
      if (ids.has(tile.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['tiles', tile.index, 'id'],
          message: `id repetido: ${tile.id}`,
        });
      }
      ids.add(tile.id);
    }
  });
