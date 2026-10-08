import { MORTGAGE_INTEREST_PERCENT } from '@gran-negocio/shared';
import type { Ctx } from '../context.js';
import { ownedAt } from '../context.js';
import { ownableAt } from './checks.js';
import type { PlayerId, TileIndex } from '../types.js';
import { transfer } from './money.js';

/**
 * El 10 % de interés de una hipoteca, redondeado siempre hacia arriba al
 * entero (SPEC.md §15.3): todo el dinero del engine es entero. Aritmética
 * entera a propósito: ceil(m · 10 / 100) sin pasar por floats.
 */
export const mortgageInterest = (mortgage: number): number =>
  Math.floor((mortgage * MORTGAGE_INTEREST_PERCENT + 99) / 100);

/**
 * Lo que cuesta levantar una hipoteca: valor + interés. AySA/Edenor: 75 + 8 =
 * 83. Al recibir una propiedad hipotecada (trueque o quiebra, M3) se paga
 * `mortgageInterest` o se levanta con esto.
 */
export const mortgageLiftCost = (mortgage: number): number => mortgage + mortgageInterest(mortgage);

/** Hipoteca: el dueño cobra el valor de hipoteca y la propiedad deja de cobrar alquiler. */
export function mortgageProperty(ctx: Ctx, playerId: PlayerId, tile: TileIndex): void {
  const found = ownableAt(tile);
  ownedAt(ctx.s, tile).mortgaged = true;
  transfer(ctx, 'bank', playerId, found.mortgage, 'mortgage', tile);
  ctx.events.push({ type: 'propertyMortgaged', playerId, tile });
}

/** Levanta la hipoteca pagando valor + 10 % (redondeado hacia arriba). */
export function unmortgageProperty(ctx: Ctx, playerId: PlayerId, tile: TileIndex): void {
  const found = ownableAt(tile);
  transfer(ctx, playerId, 'bank', mortgageLiftCost(found.mortgage), 'mortgage', tile);
  ownedAt(ctx.s, tile).mortgaged = false;
  ctx.events.push({ type: 'propertyUnmortgaged', playerId, tile });
}
