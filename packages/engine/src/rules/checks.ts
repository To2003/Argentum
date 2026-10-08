import {
  BOARD,
  GROUP_TILES,
  HOUSES_PER_HOTEL,
  isOwnable,
  tileAt,
  TILE_COUNT,
  type ColorGroup,
  type OwnableTile,
  type PropertyTile,
} from '@gran-negocio/shared';
import type { ErrorCode, PlayerId, RulesView, TileIndex } from '../types.js';
import { mortgageInterest } from './mortgage.js';

/**
 * Chequeos puros sobre el estado. No aplican nada: los usa `validateAction`
 * (la única validación) y, para calcular quién participa de una subasta de
 * edificios, el reducer.
 */

/** `houses` de un hotel: las 4 casas más el hotel (HOUSES_PER_HOTEL + 1). */
export const HOTEL = 5 as const;

export const isTileIndex = (tile: number): boolean =>
  Number.isInteger(tile) && tile >= 0 && tile < TILE_COUNT;

/**
 * La casilla comprable de un índice. Si no lo es, es un bug del engine
 * (validate ya lo habría rechazado), así que tira.
 */
export function ownableAt(tile: TileIndex): OwnableTile {
  const found = isTileIndex(tile) ? tileAt(tile) : null;
  if (found === null || !isOwnable(found)) throw new Error(`la casilla ${tile} no se compra`);
  return found;
}

export function propertyAt(tile: TileIndex): PropertyTile | null {
  if (!isTileIndex(tile)) return null;
  const found = tileAt(tile);
  return found.kind === 'property' ? found : null;
}

export const housesOn = (state: RulesView, tile: TileIndex): number =>
  state.properties[tile]?.houses ?? 0;

export const ownsWholeGroup = (state: RulesView, playerId: PlayerId, group: ColorGroup): boolean =>
  GROUP_TILES[group].every((tile) => state.properties[tile]?.ownerId === playerId);

export const groupHasBuildings = (state: RulesView, group: ColorGroup): boolean =>
  GROUP_TILES[group].some((tile) => housesOn(state, tile) > 0);

export const groupHasMortgage = (state: RulesView, group: ColorGroup): boolean =>
  GROUP_TILES[group].some((tile) => state.properties[tile]?.mortgaged === true);

/** Si una propiedad o su grupo tienen edificios (no se puede hipotecar ni intercambiar). */
export function blockedByBuildings(state: RulesView, tile: TileIndex): boolean {
  const property = propertyAt(tile);
  return property !== null && groupHasBuildings(state, property.group);
}

/**
 * ¿Puede `playerId` levantar un edificio más en `tile`, sin mirar el turno, la
 * plata ni el banco? (dueño de todo el grupo, sin hipotecas, construcción
 * pareja y sin pasarse del hotel).
 */
export function buildShapeError(
  state: RulesView,
  playerId: PlayerId,
  tile: TileIndex,
): ErrorCode | null {
  const property = propertyAt(tile);
  if (property === null) return 'INVALID_TILE';
  if (state.properties[tile]?.ownerId !== playerId) return 'NOT_OWNER';
  if (!ownsWholeGroup(state, playerId, property.group)) return 'INCOMPLETE_GROUP';
  if (groupHasMortgage(state, property.group)) return 'GROUP_MORTGAGED';
  const houses = housesOn(state, tile);
  if (houses >= HOTEL) return 'MAX_BUILDINGS';
  if (state.rules.evenBuild) {
    const min = Math.min(...GROUP_TILES[property.group].map((t) => housesOn(state, t)));
    if (houses > min) return 'UNEVEN_BUILDING';
  }
  return null;
}

/** El próximo edificio en `tile` es un hotel (ya tiene 4 casas). */
export const nextIsHotel = (state: RulesView, tile: TileIndex): boolean =>
  housesOn(state, tile) === HOUSES_PER_HOTEL;

/** Chequeo completo para construir, incluida la plata y el stock del banco. */
export function buildError(
  state: RulesView,
  playerId: PlayerId,
  tile: TileIndex,
): ErrorCode | null {
  const shape = buildShapeError(state, playerId, tile);
  if (shape !== null) return shape;
  const hotel = nextIsHotel(state, tile);
  if (hotel ? state.bank.hotels < 1 : state.bank.houses < 1) return 'NO_BUILDINGS_LEFT';
  const property = propertyAt(tile);
  const cash = state.players[playerId]?.cash ?? 0;
  if (property === null || cash < property.houseCost) return 'INSUFFICIENT_FUNDS';
  return null;
}

/**
 * La primera propiedad (por índice) donde `playerId` puede levantar un
 * edificio del tipo pedido. Es el destino de la casa u hotel que gana en una
 * subasta de escasez si no fue quien la pidió (SPEC.md §15.5).
 */
export function firstBuildableTile(
  state: RulesView,
  playerId: PlayerId,
  building: 'house' | 'hotel',
): TileIndex | null {
  for (const tile of BOARD) {
    if (tile.kind !== 'property') continue;
    if (buildShapeError(state, playerId, tile.index) !== null) continue;
    if (nextIsHotel(state, tile.index) === (building === 'hotel')) return tile.index;
  }
  return null;
}

/** Vender un edificio de `tile` respetando la venta pareja (SPEC.md §5.4). */
export function sellError(state: RulesView, playerId: PlayerId, tile: TileIndex): ErrorCode | null {
  const property = propertyAt(tile);
  if (property === null) return 'INVALID_TILE';
  if (state.properties[tile]?.ownerId !== playerId) return 'NOT_OWNER';
  const houses = housesOn(state, tile);
  if (houses === 0) return 'MAX_BUILDINGS';
  if (state.rules.evenBuild) {
    const max = Math.max(...GROUP_TILES[property.group].map((t) => housesOn(state, t)));
    if (houses < max) return 'UNEVEN_BUILDING';
  }
  // Un hotel vuelve a 4 casas: el banco tiene que tenerlas. Si no, sellAllBuildings.
  if (houses === HOTEL && state.bank.houses < HOUSES_PER_HOTEL) return 'NO_BUILDINGS_LEFT';
  return null;
}

export function mortgageError(
  state: RulesView,
  playerId: PlayerId,
  tile: TileIndex,
): ErrorCode | null {
  if (!isTileIndex(tile) || !isOwnable(tileAt(tile))) return 'INVALID_TILE';
  const owned = state.properties[tile];
  if (owned?.ownerId !== playerId) return 'NOT_OWNER';
  if (owned.mortgaged) return 'ALREADY_MORTGAGED';
  if (blockedByBuildings(state, tile)) return 'HAS_BUILDINGS';
  return null;
}

export function unmortgageError(
  state: RulesView,
  playerId: PlayerId,
  tile: TileIndex,
  liftCost: (mortgage: number) => number,
): ErrorCode | null {
  if (!isTileIndex(tile)) return 'INVALID_TILE';
  const found = tileAt(tile);
  if (!isOwnable(found)) return 'INVALID_TILE';
  const owned = state.properties[tile];
  if (owned?.ownerId !== playerId) return 'NOT_OWNER';
  if (!owned.mortgaged) return 'NOT_MORTGAGED';
  if ((state.players[playerId]?.cash ?? 0) < liftCost(found.mortgage)) return 'INSUFFICIENT_FUNDS';
  return null;
}

/** El 10 % que se paga al recibir propiedades hipotecadas (trueque o quiebra). */
export function interestOnMortgaged(state: RulesView, tiles: readonly TileIndex[]): number {
  let total = 0;
  for (const tile of tiles) {
    if (state.properties[tile]?.mortgaged !== true) continue;
    const found = tileAt(tile);
    if (isOwnable(found)) total += mortgageInterest(found.mortgage);
  }
  return total;
}
