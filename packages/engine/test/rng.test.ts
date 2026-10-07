import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createRng,
  nextFloat,
  nextInt,
  rollDice,
  rollDie,
  shuffle,
  type RngState,
} from '../src/index.js';

const seed = fc.integer({ min: 0, max: 0xffffffff });

/** Corre `n` tiradas encadenando el estado, como lo hará el reducer. */
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

describe('rng', () => {
  it('normaliza la semilla a uint32', () => {
    expect(createRng(-1)).toBe(0xffffffff);
    expect(createRng(2 ** 32 + 5)).toBe(5);
  });

  it('mismo seed, misma secuencia (determinismo)', () => {
    fc.assert(
      fc.property(seed, (s) => {
        expect(rollMany(createRng(s), 50)).toEqual(rollMany(createRng(s), 50));
      }),
    );
  });

  it('fija la secuencia de un seed conocido (regresión)', () => {
    // Si este test cambia, cambió el PRNG y se rompen todos los replays guardados.
    expect(rollMany(createRng(42), 10)).toMatchInlineSnapshot(`
      [
        4,
        3,
        6,
        5,
        2,
        4,
        2,
        4,
        6,
        3,
      ]
    `);
  });

  it('nextFloat queda en [0, 1)', () => {
    fc.assert(
      fc.property(seed, (s) => {
        const { value } = nextFloat(createRng(s));
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }),
    );
  });

  it('nextInt rechaza bounds inválidos', () => {
    expect(() => nextInt(1, 0)).toThrow(RangeError);
    expect(() => nextInt(1, 1.5)).toThrow(RangeError);
  });

  it('los dados caen en [1, 6] y salen todas las caras', () => {
    const faces = rollMany(createRng(7), 6000);
    expect(Math.min(...faces)).toBe(1);
    expect(Math.max(...faces)).toBe(6);
    // Chequeo grueso de uniformidad: cada cara ~1000 veces.
    for (let face = 1; face <= 6; face += 1) {
      const count = faces.filter((f) => f === face).length;
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1150);
    }
  });

  it('rollDice encadena dos tiradas', () => {
    const state = createRng(123);
    const first = rollDie(state);
    const second = rollDie(first.state);
    expect(rollDice(state)).toEqual({ value: [first.value, second.value], state: second.state });
  });

  it('shuffle es una permutación y no muta la entrada', () => {
    fc.assert(
      fc.property(seed, fc.array(fc.integer()), (s, items) => {
        const copy = [...items];
        const { value } = shuffle(createRng(s), items);
        expect(items).toEqual(copy);
        expect([...value].sort((a, b) => a - b)).toEqual([...items].sort((a, b) => a - b));
      }),
    );
  });
});
