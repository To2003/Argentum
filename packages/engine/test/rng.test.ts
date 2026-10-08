import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createRng,
  isSeed,
  nextFloat,
  nextInt,
  rollDice,
  rollDie,
  shuffle,
  type RngState,
} from '../src/index.js';

const seedArb = fc
  .array(fc.integer({ min: 0, max: 15 }), { minLength: 32, maxLength: 32 })
  .map((digits) => digits.map((d) => d.toString(16)).join(''));

/** Corre `n` tiradas encadenando el estado, como lo hace el reducer. */
const rollMany = (state: RngState, n: number): number[] => {
  const faces: number[] = [];
  let current = state;
  for (let i = 0; i < n; i += 1) {
    const draw = rollDie(current);
    faces.push(draw.value);
    current = draw.state;
  }
  return faces;
};

/** sfc32 tal como lo publica su autor (PractRand), en la versión JS de referencia. */
function referenceSfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

const SEED_42 = '0000002a0000002a0000002a0000002a';

describe('rng (sfc32)', () => {
  it('coincide con la implementación de referencia (después del warm-up de 15 rondas)', () => {
    const reference = referenceSfc32(0x2a, 0x2a, 0x2a, 0x2a);
    for (let i = 0; i < 15; i += 1) reference();
    let state = createRng(SEED_42);
    for (let i = 0; i < 1000; i += 1) {
      const draw = nextFloat(state);
      expect(draw.value).toBe(reference());
      state = draw.state;
    }
  });

  it('el estado son 4 uint32 (128 bits)', () => {
    const state = createRng('ffffffffffffffffffffffffffffffff');
    expect(state).toHaveLength(4);
    for (const word of state) {
      expect(Number.isInteger(word)).toBe(true);
      expect(word).toBeGreaterThanOrEqual(0);
      expect(word).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('rechaza seeds que no son 128 bits en hex minúscula', () => {
    expect(isSeed(SEED_42)).toBe(true);
    for (const bad of ['', '2a', 'G'.repeat(32), 'A'.repeat(32), '0'.repeat(31), '0'.repeat(33)]) {
      expect(isSeed(bad)).toBe(false);
      expect(() => createRng(bad)).toThrow(RangeError);
    }
  });

  it('mismo seed, misma secuencia (determinismo)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        expect(rollMany(createRng(seed), 50)).toEqual(rollMany(createRng(seed), 50));
      }),
    );
  });

  it('fija la secuencia de un seed conocido (regresión)', () => {
    // Si este test cambia, cambió el PRNG y se rompen todos los replays guardados.
    expect(rollMany(createRng(SEED_42), 12)).toMatchInlineSnapshot(`
      [
        2,
        3,
        2,
        6,
        3,
        3,
        4,
        6,
        1,
        1,
        4,
        2,
      ]
    `);
  });

  it('un seed con estructura no se nota en las primeras tiradas (warm-up)', () => {
    const zeros = rollMany(createRng('0'.repeat(32)), 12);
    expect(new Set(zeros).size).toBeGreaterThan(2);
  });

  it('nextFloat queda en [0, 1)', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const { value } = nextFloat(createRng(seed));
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }),
    );
  });

  it('nextInt rechaza bounds inválidos', () => {
    const state = createRng(SEED_42);
    expect(() => nextInt(state, 0)).toThrow(RangeError);
    expect(() => nextInt(state, 1.5)).toThrow(RangeError);
  });

  it('los dados caen en [1, 6] y salen todas las caras con frecuencia pareja', () => {
    const faces = rollMany(createRng('00000000000000000000000000000007'), 6000);
    expect(Math.min(...faces)).toBe(1);
    expect(Math.max(...faces)).toBe(6);
    for (let face = 1; face <= 6; face += 1) {
      const count = faces.filter((f) => f === face).length;
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1150);
    }
  });

  it('rollDice encadena dos tiradas', () => {
    const state = createRng(SEED_42);
    const first = rollDie(state);
    const second = rollDie(first.state);
    expect(rollDice(state)).toEqual({ value: [first.value, second.value], state: second.state });
  });

  it('shuffle es una permutación y no muta la entrada', () => {
    fc.assert(
      fc.property(seedArb, fc.array(fc.integer()), (seed, items) => {
        const copy = [...items];
        const { value } = shuffle(createRng(seed), items);
        expect(items).toEqual(copy);
        expect([...value].sort((a, b) => a - b)).toEqual([...items].sort((a, b) => a - b));
      }),
    );
  });
});
