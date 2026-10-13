import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkProperty } from './fuzzReport.js';
import { randomPlay, replay } from './invariants.js';
import {
  ADVANCED_NAME,
  advancedProperty,
  newCoverage,
  reportCoverage,
  hex32,
  replayAdvanced,
  replayOf,
  setupArb,
} from './scenarios.js';

/*
 * Las propiedades pasan por `checkProperty` (fuzzReport.ts): si alguna falla,
 * el error trae seed, path, contraejemplo y la secuencia de acciones, y queda
 * en test-results/fuzz-failure-*.json. Con FUZZ_SEED y FUZZ_PATH se reproduce.
 */

const INVARIANTS_NAME = 'cualquier secuencia de acciones legales mantiene las invariantes';

describe('fuzz de invariantes', () => {
  it(
    INVARIANTS_NAME,
    () => {
      checkProperty(
        INVARIANTS_NAME,
        fc.property(setupArb, hex32, (setup, policySeed) => {
          randomPlay(setup, { steps: 400, policySeed });
        }),
        { numRuns: 80 },
        (setup, policySeed) => replayOf(() => randomPlay(setup, { steps: 400, policySeed })),
      );
    },
    120_000,
  );
});

describe('fuzz de partida avanzada (construcción y escasez)', () => {
  it(
    ADVANCED_NAME,
    () => {
      // Cobertura de la corrida: se informa siempre (también si falla) y no decide nada.
      const coverage = newCoverage();
      try {
        checkProperty(ADVANCED_NAME, advancedProperty(coverage), { numRuns: 40 }, replayAdvanced);
      } finally {
        reportCoverage(ADVANCED_NAME, coverage);
      }
    },
    120_000,
  );
});

const REPLAY_NAME = 'seed + acciones reconstruye exactamente el mismo estado y los mismos eventos';

describe('replay', () => {
  it(
    REPLAY_NAME,
    () => {
      checkProperty(
        REPLAY_NAME,
        fc.property(setupArb, hex32, (setup, policySeed) => {
          const played = randomPlay(setup, { steps: 300, policySeed });
          const replayed = replay(setup, played.log);
          expect(replayed.state).toEqual(played.state);
          expect(replayed.events).toEqual(played.events);
        }),
        { numRuns: 40 },
        (setup, policySeed) => replayOf(() => randomPlay(setup, { steps: 300, policySeed })),
      );
    },
    120_000,
  );

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
