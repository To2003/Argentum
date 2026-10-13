import { describe, it } from 'vitest';
import { checkProperty } from './fuzzReport.js';
import {
  ADVANCED_NAME,
  advancedProperty,
  coverageGaps,
  newCoverage,
  replayAdvanced,
} from './scenarios.js';

/**
 * Un tramo de `pnpm fuzz:loop` (scripts/fuzz-loop.ts): corre el escenario de
 * partida avanzada, igual que el test (40 casos), con las semillas
 * FUZZ_LOOP_BASE + FUZZ_LOOP_FROM … + FUZZ_LOOP_COUNT − 1, y se detiene en la
 * primera falla (que queda en test-results/fuzz-failure-*.json). Cada corrida
 * informa su cobertura en una línea que el script junta. Sin esas variables no
 * corre: no es parte de `pnpm test`.
 */
const count = Number(process.env['FUZZ_LOOP_COUNT'] ?? 0);
const from = Number(process.env['FUZZ_LOOP_FROM'] ?? 0);
const base = Number(process.env['FUZZ_LOOP_BASE'] ?? 0);

describe.runIf(count > 0)('fuzz:loop', () => {
  it(
    'partida avanzada, una corrida por semilla hasta la primera falla',
    () => {
      for (let i = 0; i < count; i += 1) {
        const seed = base + from + i;
        const coverage = newCoverage();
        const run = `corrida=${String(from + i)} seed=${String(seed)}`;
        try {
          checkProperty(
            ADVANCED_NAME,
            advancedProperty(coverage),
            { numRuns: 40, seed },
            replayAdvanced,
          );
        } catch (error) {
          process.stdout.write(`LOOP FAIL ${run} cobertura=${JSON.stringify(coverage)}\n`);
          throw error;
        }
        const gaps = coverageGaps(coverage);
        process.stdout.write(`LOOP OK ${run} cobertura=${JSON.stringify({ ...coverage, gaps })}\n`);
      }
    },
    24 * 60 * 60 * 1000,
  );
});
