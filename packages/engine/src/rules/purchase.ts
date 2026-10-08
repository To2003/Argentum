import { tileAt, isOwnable } from '@gran-negocio/shared';
import type { Ctx } from '../context.js';
import type { PlayerId, TileIndex } from '../types.js';
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

export function declineProperty(ctx: Ctx, playerId: PlayerId, tile: TileIndex): void {
  ctx.events.push({ type: 'purchaseDeclined', playerId, tile });
  onPurchaseDeclined(ctx, tile);
}

/**
 * Punto de extensión de la subasta (SPEC.md §15.4).
 *
 * TODO(M3): con `rules.auctionOnDecline`, abrir la fase `auction` con
 * `returnTo: finishResolution` en vez de dejar la propiedad sin dueño. Hoy
 * (M2) la propiedad sigue siendo del banco y el turno sigue.
 */
function onPurchaseDeclined(_ctx: Ctx, _tile: TileIndex): void {
  // Sin subasta todavía: no hay nada que hacer.
}
