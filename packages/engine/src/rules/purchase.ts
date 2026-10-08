import { tileAt, isOwnable } from '@gran-negocio/shared';
import type { Ctx } from '../context.js';
import type { PlayerId, TileIndex } from '../types.js';
import { openPropertyAuction } from './auction.js';
import { transfer } from './money.js';

export function priceOf(tileIndex: TileIndex): number {
  const tile = tileAt(tileIndex);
  if (!isOwnable(tile)) throw new Error(`la casilla ${tileIndex} no se compra`);
  return tile.price;
}

export function buyProperty(ctx: Ctx, playerId: PlayerId, tile: TileIndex): void {
  transfer(ctx, playerId, 'bank', priceOf(tile), 'purchase', tile);
  ctx.s.properties[tile] = { ownerId: playerId, houses: 0, mortgaged: false };
  ctx.events.push({ type: 'propertyBought', playerId, tile });
}

/** Devuelve si abrió una subasta (si no, la propiedad queda en el banco). */
export function declineProperty(ctx: Ctx, playerId: PlayerId, tile: TileIndex): boolean {
  ctx.events.push({ type: 'purchaseDeclined', playerId, tile });
  return onPurchaseDeclined(ctx, tile);
}

/**
 * Punto de extensión de la subasta (SPEC.md §15.4): con `auctionOnDecline`, la
 * propiedad rechazada se subasta entre todos los jugadores activos, incluido
 * el que la rechazó, y al cerrar se termina la resolución de la casilla.
 */
function onPurchaseDeclined(ctx: Ctx, tile: TileIndex): boolean {
  if (!ctx.s.rules.auctionOnDecline) return false;
  openPropertyAuction(ctx, tile, [], { kind: 'finishResolution' });
  return true;
}
