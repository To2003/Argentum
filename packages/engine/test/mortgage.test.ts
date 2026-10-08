import { BOARD, isOwnable } from '@gran-negocio/shared';
import { describe, expect, it } from 'vitest';
import { mortgageInterest, mortgageLiftCost } from '../src/index.js';

describe('mortgageLiftCost (SPEC §15.3: 10 % redondeado hacia arriba)', () => {
  /** [hipoteca, interés, costo de levantarla] para cada valor que existe en el tablero. */
  const TABLE = [
    [30, 3, 33],
    [50, 5, 55],
    [60, 6, 66],
    [70, 7, 77],
    [75, 8, 83], // Edenor y AySA: $7,50 → $8
    [80, 8, 88],
    [90, 9, 99],
    [100, 10, 110],
    [110, 11, 121],
    [120, 12, 132],
    [130, 13, 143],
    [140, 14, 154],
    [150, 15, 165],
    [160, 16, 176],
    [175, 18, 193], // Obelisco: $17,50 → $18
    [200, 20, 220],
  ] as const;

  it('la tabla cubre exactamente las hipotecas del tablero', () => {
    const mortgages = new Set(BOARD.filter(isOwnable).map((tile) => tile.mortgage));
    expect([...mortgages].sort((a, b) => a - b)).toEqual(TABLE.map(([m]) => m));
  });

  it.each(TABLE)('hipoteca $%i → interés $%i, levantarla $%i', (mortgage, interest, lift) => {
    expect(mortgageInterest(mortgage)).toBe(interest);
    expect(mortgageLiftCost(mortgage)).toBe(lift);
    expect(Number.isInteger(mortgageLiftCost(mortgage))).toBe(true);
  });
});
