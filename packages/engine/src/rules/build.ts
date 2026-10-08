import {
  BUILDING_RESALE_PERCENT,
  GROUP_TILES,
  HOUSES_PER_HOTEL,
  type ColorGroup,
} from '@gran-negocio/shared';
import type { Ctx } from '../context.js';
import { activePlayers, ownedAt } from '../context.js';
import type { OwnedProperty, PlayerId, ResumePoint, TileIndex } from '../types.js';
import { buildingTarget, openBuildingAuction } from './auction.js';
import { HOTEL, firstBuildableTile, housesOn, nextIsHotel, propertyAt } from './checks.js';
import { transfer } from './money.js';

const houseCostOf = (tile: TileIndex): number => {
  const property = propertyAt(tile);
  if (property === null) throw new Error(`la casilla ${tile} no es una propiedad`);
  return property.houseCost;
};

/** Pone un edificio (sin cobrar): casa del stock, o hotel devolviendo las 4 casas. */
export function placeBuilding(ctx: Ctx, playerId: PlayerId, tile: TileIndex): void {
  const property = ownedAt(ctx.s, tile);
  if (property.houses === HOUSES_PER_HOTEL) {
    ctx.s.bank.hotels -= 1;
    ctx.s.bank.houses += HOUSES_PER_HOTEL;
    property.houses = HOTEL;
  } else {
    ctx.s.bank.houses -= 1;
    property.houses = (property.houses + 1) as OwnedProperty['houses'];
  }
  ctx.events.push({ type: 'buildingBuilt', playerId, tile, houses: property.houses });
}

/**
 * Construye en `tile`. Si es la última casa (u hotel) del banco y hay otros
 * jugadores que también podrían construirla, se subasta entre los interesados
 * en vez de venderla (SPEC.md §5.4, §15.5).
 */
export function buildHouse(
  ctx: Ctx,
  playerId: PlayerId,
  tile: TileIndex,
  returnTo: ResumePoint,
): void {
  const building = nextIsHotel(ctx.s, tile) ? 'hotel' : 'house';
  const lastOne = building === 'hotel' ? ctx.s.bank.hotels === 1 : ctx.s.bank.houses === 1;
  if (lastOne) {
    const rivals = activePlayers(ctx.s).filter(
      (id) => id !== playerId && firstBuildableTile(ctx.s, id, building) !== null,
    );
    const lot = { kind: 'building', building, initiator: playerId, tile } as const;
    const interested = rivals.filter((id) => {
      const target = buildingTarget(ctx.s, lot, id);
      const price = target === null ? Infinity : houseCostOf(target);
      return (ctx.s.players[id]?.cash ?? 0) >= price;
    });
    if (interested.length > 0) {
      openBuildingAuction(ctx, lot, [playerId, ...interested], returnTo);
      return;
    }
  }
  transfer(ctx, playerId, 'bank', houseCostOf(tile), 'building', tile);
  placeBuilding(ctx, playerId, tile);
}

const resale = (tile: TileIndex, buildings: number): number =>
  Math.floor((buildings * houseCostOf(tile) * BUILDING_RESALE_PERCENT) / 100);

/** Vende un edificio al banco a la mitad. Un hotel vuelve a 4 casas. */
export function sellBuilding(ctx: Ctx, playerId: PlayerId, tile: TileIndex): void {
  const property = ownedAt(ctx.s, tile);
  if (property.houses === HOTEL) {
    ctx.s.bank.hotels += 1;
    ctx.s.bank.houses -= HOUSES_PER_HOTEL;
    property.houses = HOUSES_PER_HOTEL;
  } else {
    ctx.s.bank.houses += 1;
    property.houses = (property.houses - 1) as OwnedProperty['houses'];
  }
  transfer(ctx, 'bank', playerId, resale(tile, 1), 'building', tile);
  ctx.events.push({ type: 'buildingSold', playerId, tile, houses: property.houses });
}

/**
 * Vende todos los edificios de un grupo de una vez. Es la salida cuando el
 * banco no tiene las 4 casas para desarmar un hotel (SPEC.md §15.5).
 */
export function sellAllBuildings(ctx: Ctx, playerId: PlayerId, group: ColorGroup): void {
  for (const tile of GROUP_TILES[group]) {
    const houses = housesOn(ctx.s, tile);
    if (houses === 0) continue;
    const property = ownedAt(ctx.s, tile);
    if (houses === HOTEL) ctx.s.bank.hotels += 1;
    else ctx.s.bank.houses += houses;
    property.houses = 0;
    transfer(ctx, 'bank', playerId, resale(tile, houses), 'building', tile);
    ctx.events.push({ type: 'buildingSold', playerId, tile, houses: 0 });
  }
}
