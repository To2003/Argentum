import { MORTGAGE_INTEREST_PERCENT } from '@gran-negocio/shared';

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
