import fc from 'fast-check';
import { DEFAULT_RULES } from '@gran-negocio/shared';
import { describe, expect, it } from 'vitest';
import type { GameSetup } from '../src/index.js';
import { randomPlay, replay } from './invariants.js';

const hex32 = fc
  .array(fc.integer({ min: 0, max: 15 }), { minLength: 32, maxLength: 32 })
  .map((digits) => digits.map((d) => d.toString(16)).join(''));

const setupArb = fc
  .record({
    seed: hex32,
    players: fc.integer({ min: 2, max: 6 }),
    freeParkingPot: fc.boolean(),
    doubleRentOnMonopoly: fc.boolean(),
    startingCash: fc.constantFrom(500, 1500),
  })
  .map(({ seed, players, ...rules }): GameSetup => ({
    seed,
    rules: { ...DEFAULT_RULES, ...rules },
    players: Array.from({ length: players }, (_, i) => ({
      id: `p${i + 1}`,
      name: `J${i + 1}`,
      tokenId: `t${i + 1}`,
    })),
  }));

describe('fuzz de invariantes', () => {
  it('cualquier secuencia de acciones legales mantiene las invariantes', () => {
    fc.assert(
      fc.property(setupArb, hex32, (setup, policySeed) => {
        randomPlay(setup, { steps: 400, policySeed });
      }),
      { numRuns: 80 },
    );
  }, 120_000);
});

describe('replay', () => {
  it('seed + acciones reconstruye exactamente el mismo estado y los mismos eventos', () => {
    fc.assert(
      fc.property(setupArb, hex32, (setup, policySeed) => {
        const played = randomPlay(setup, { steps: 300, policySeed });
        const replayed = replay(setup, played.log);
        expect(replayed.state).toEqual(played.state);
        expect(replayed.events).toEqual(played.events);
      }),
      { numRuns: 40 },
    );
  }, 120_000);

  it('otro seed con las mismas acciones da otra partida', () => {
    const setup = fc.sample(setupArb, { numRuns: 1, seed: 7 })[0];
    if (setup === undefined) throw new Error('sin setup');
    const played = randomPlay(setup, { steps: 50, policySeed: '0'.repeat(32) });
    const other = {
      ...setup,
      seed: setup.seed === 'f'.repeat(32) ? '0'.repeat(32) : 'f'.repeat(32),
    };
    const differs = (() => {
      try {
        return JSON.stringify(replay(other, played.log).state) !== JSON.stringify(played.state);
      } catch {
        return true; // con otros dados, alguna acción del log ya no es legal
      }
    })();
    expect(differs).toBe(true);
  });
});
