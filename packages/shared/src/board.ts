import boardJson from '../data/board.json' with { type: 'json' };
import type { z } from 'zod';
import { COLOR_GROUPS } from './constants.js';
import type { ColorGroupSchema, TileSchema } from './schemas/board.js';

export type Tile = z.infer<typeof TileSchema>;
export type TileKind = Tile['kind'];
export type ColorGroup = z.infer<typeof ColorGroupSchema>;
export type PropertyTile = Extract<Tile, { kind: 'property' }>;
export type SubwayTile = Extract<Tile, { kind: 'subway' }>;
export type UtilityTile = Extract<Tile, { kind: 'utility' }>;
export type TaxTile = Extract<Tile, { kind: 'tax' }>;
/** Lo que se puede comprar, hipotecar e intercambiar. */
export type OwnableTile = PropertyTile | SubwayTile | UtilityTile;

/**
 * Las 40 casillas.
 *
 * No se parsea con zod acá: eso metería zod en el bundle del cliente (+30 kB
 * gzip) para validar un archivo que no cambia en runtime. La validación es de
 * build: los tests corren `BoardSchema` sobre board.json, y el server lo vuelve
 * a validar al arrancar (`validateGameData`). Por eso el cast es seguro.
 */
export const BOARD: readonly Tile[] = Object.freeze(boardJson.tiles as unknown as Tile[]);

export const isOwnable = (tile: Tile): tile is OwnableTile =>
  tile.kind === 'property' || tile.kind === 'subway' || tile.kind === 'utility';

export const isProperty = (tile: Tile): tile is PropertyTile => tile.kind === 'property';

/** La casilla de un índice. Un índice fuera de rango es un bug de quien llama. */
export function tileAt(index: number): Tile {
  const tile = BOARD[index];
  if (tile === undefined) throw new RangeError(`no hay casilla ${index}`);
  return tile;
}

const indicesOf = (predicate: (tile: Tile) => boolean): readonly number[] =>
  Object.freeze(BOARD.filter(predicate).map((tile) => tile.index));

/** Índices de las propiedades de cada grupo, en orden de tablero. */
export const GROUP_TILES: Readonly<Record<ColorGroup, readonly number[]>> = Object.freeze(
  Object.fromEntries(
    COLOR_GROUPS.map((group) => [
      group,
      indicesOf((tile) => tile.kind === 'property' && tile.group === group),
    ]),
  ) as Record<ColorGroup, readonly number[]>,
);

export const SUBWAY_TILES = indicesOf((tile) => tile.kind === 'subway');
export const UTILITY_TILES = indicesOf((tile) => tile.kind === 'utility');
