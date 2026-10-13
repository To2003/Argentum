import fc from 'fast-check';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkProperty, reportPath, type FuzzReport } from './fuzzReport.js';
import { FuzzFailure, randomPlay } from './invariants.js';
import { replayOf } from './scenarios.js';
import { newGame } from './support.js';

/** Las fallas del fuzz tienen que ser siempre reproducibles (ver fuzzReport.ts). */
const NAME = 'propiedad de prueba que falla a propósito';

const failure = (run: () => void): string => {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('la propiedad no falló');
};

const readReport = (name: string) =>
  JSON.parse(readFileSync(reportPath(name), 'utf8')) as FuzzReport;

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(reportPath(NAME), { force: true });
  rmSync(reportPath(`${NAME} (partida)`), { force: true });
});

describe('reporte de fallas del fuzz', () => {
  it('el error trae seed, path y contraejemplo mínimo, y queda en un archivo', () => {
    const message = failure(() => {
      checkProperty(
        NAME,
        fc.property(fc.integer(), (n) => n < 50),
        { numRuns: 200, seed: 42 },
      );
    });
    expect(message).toContain('seed: 42');
    expect(message).toMatch(/path: \d+(:\d+)*/);
    // El mínimo que rompe `n < 50`, ya achicado por fast-check.
    expect(message).toContain('contraejemplo: [50]');
    expect(message).toContain('FUZZ_SEED=42');

    const report = readReport(NAME);
    expect(report).toMatchObject({ property: NAME, seed: 42, counterexample: [50] });
    expect(report.path).not.toBe('');
    expect(report.reproducePowerShell).toContain('$env:FUZZ_SEED=42');
  });

  it('con FUZZ_SEED y FUZZ_PATH se reproduce exactamente el mismo caso', () => {
    failure(() => {
      checkProperty(
        NAME,
        fc.property(fc.array(fc.integer()), (xs) => xs.length < 3),
        { numRuns: 200 },
      );
    });
    const first = readReport(NAME);
    vi.stubEnv('FUZZ_SEED', String(first.seed));
    vi.stubEnv('FUZZ_PATH', first.path);
    failure(() => {
      checkProperty(
        NAME,
        fc.property(fc.array(fc.integer()), (xs) => xs.length < 3),
        { numRuns: 200 },
      );
    });
    const again = readReport(NAME);
    expect(again.counterexample).toEqual(first.counterexample);
    expect(again.seed).toBe(first.seed);
    expect(again.numRuns).toBe(1);
  });

  it('un contraejemplo largo sale entero, sin truncar', () => {
    const message = failure(() => {
      checkProperty(
        NAME,
        fc.property(fc.constant(Array.from({ length: 300 }, (_, i) => i)), () => false),
        { numRuns: 1 },
      );
    });
    expect(message).toContain('299]');
    expect(message).not.toMatch(/…|\.\.\.\s*\d+ more/);
  });

  it('una falla en medio de una partida trae la secuencia de acciones que la produjo', () => {
    const name = `${NAME} (partida)`;
    // Rompe a propósito una invariante después de jugar: sacar una casa del banco.
    const breakAfter = (steps: number) => {
      const played = randomPlay(
        {
          seed: '0123456789abcdef0123456789abcdef',
          rules: newGame(2).rules,
          players: [
            { id: 'p1', name: 'A', tokenId: 't1' },
            { id: 'p2', name: 'B', tokenId: 't2' },
          ],
        },
        { steps, policySeed: 'f'.repeat(32) },
      );
      throw new FuzzFailure(new Error('invariante rota a propósito'), played.log, steps);
    };
    failure(() => {
      checkProperty(
        name,
        fc.property(fc.integer({ min: 5, max: 20 }), (steps) => {
          breakAfter(steps);
        }),
        { numRuns: 10, seed: 7 },
        (steps) => replayOf(() => breakAfter(steps)),
      );
    });
    const report = readReport(name);
    expect(report.counterexample).toEqual([5]);
    expect(report.failedAtStep).toBe(5);
    expect(report.error).toContain('invariante rota a propósito');
    expect(report.actions?.length).toBeGreaterThan(0);
    expect(report.actions?.[0]).toHaveProperty('action.type');
    expect(existsSync(reportPath(name))).toBe(true);
  });

  it('randomPlay envuelve una invariante rota en FuzzFailure, con el paso y las acciones', () => {
    let caught: unknown = null;
    try {
      randomPlay(
        {
          seed: '0123456789abcdef0123456789abcdef',
          rules: newGame(2).rules,
          players: [
            { id: 'p1', name: 'A', tokenId: 't1' },
            { id: 'p2', name: 'B', tokenId: 't2' },
          ],
        },
        {
          steps: 10,
          policySeed: 'f'.repeat(32),
          // Escenario roto: 31 casas en el banco y ninguna en el tablero no suman 32.
          prepare: (state) => {
            state.bank.houses = 31;
          },
        },
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(FuzzFailure);
    const failure = caught as FuzzFailure;
    expect(failure.step).toBe(0);
    expect(failure.log).toEqual([]);
    expect(failure.message).toMatch(/^falla en el paso 0 \(después de 0 acciones\): /);
  });
});
