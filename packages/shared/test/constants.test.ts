import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS, MIN_PLAYERS, TILE_COUNT } from '../src/index.js';

describe('constantes', () => {
  it('respetan el SPEC', () => {
    expect(TILE_COUNT).toBe(40);
    expect(MIN_PLAYERS).toBe(2);
    expect(MAX_PLAYERS).toBe(6);
  });
});
