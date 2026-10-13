import fc from 'fast-check';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { LoggedAction } from './invariants.js';

/**
 * `fc.assert` con una falla siempre reproducible. Si la propiedad falla:
 *
 * - el error trae, completos, la semilla, el path y el contraejemplo mínimo
 *   (y, si se sabe, la secuencia de acciones de la partida);
 * - se escribe todo en `test-results/fuzz-failure-<nombre>.json` (el CI lo sube
 *   como artefacto);
 * - con `FUZZ_SEED` y `FUZZ_PATH` en el entorno se reproduce exactamente ese
 *   caso (el JSON trae el comando).
 */

/** Carpeta del reporte, en la raíz del repo (está en .gitignore). */
export const REPORT_DIR = fileURLToPath(new URL('../../../test-results/', import.meta.url));

/** Lo que se sabe de un caso al volver a jugarlo: sus acciones y por qué falló. */
export interface Replay {
  readonly actions: readonly LoggedAction[];
  readonly failedAtStep: number | null;
  readonly error: string | null;
}

export interface FuzzReport {
  readonly property: string;
  readonly seed: number;
  readonly path: string;
  readonly numRuns: number;
  readonly counterexample: unknown;
  readonly error: string;
  readonly failedAtStep: number | null;
  readonly actions: readonly LoggedAction[] | null;
  /** Para bash; `reproducePowerShell`, para Windows. */
  readonly reproduce: string;
  readonly reproducePowerShell: string;
}

const slug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Parámetros para reproducir un caso pedido por el entorno (o ninguno). */
function reproduceParams(): { seed?: number; path?: string } {
  const seed = process.env['FUZZ_SEED'];
  const path = process.env['FUZZ_PATH'];
  if (seed === undefined || seed === '') return {};
  return path === undefined || path === '' ? { seed: Number(seed) } : { seed: Number(seed), path };
}

export function reportPath(property: string): string {
  return `${REPORT_DIR}fuzz-failure-${slug(property)}.json`;
}

/** Escribe el reporte y devuelve el mensaje completo del error. */
export function writeReport(report: FuzzReport): string {
  mkdirSync(REPORT_DIR, { recursive: true });
  const file = reportPath(report.property);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return [
    `Falló la propiedad "${report.property}".`,
    `  seed: ${report.seed}`,
    `  path: ${report.path}`,
    `  contraejemplo: ${fc.stringify(report.counterexample)}`,
    `  error: ${report.error}`,
    report.actions === null
      ? null
      : `  acciones (${report.actions.length}, falla en el paso ${report.failedAtStep ?? 'final'}): ver el archivo`,
    `  reporte: ${file}`,
    `  reproducir: ${report.reproduce}`,
    `  reproducir (PowerShell): ${report.reproducePowerShell}`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function checkProperty<Ts extends [unknown, ...unknown[]]>(
  name: string,
  property: fc.IProperty<Ts>,
  params: fc.Parameters<Ts>,
  /** Vuelve a jugar el contraejemplo para tener sus acciones (opcional). */
  replay?: (...args: Ts) => Replay,
): void {
  const details = fc.check(property, { ...params, ...reproduceParams() });
  if (!details.failed) return;
  const counterexample = details.counterexample;
  const info: Replay | null =
    counterexample === null || replay === undefined ? null : replay(...counterexample);
  const error =
    info?.error ??
    (details.errorInstance instanceof Error
      ? details.errorInstance.message
      : details.errorInstance === null
        ? 'la propiedad devolvió false'
        : fc.stringify(details.errorInstance));
  const path = details.counterexamplePath ?? '';
  const run = `pnpm vitest run --project engine -t ${JSON.stringify(name)}`;
  const message = writeReport({
    property: name,
    seed: details.seed,
    path,
    numRuns: details.numRuns,
    counterexample,
    error,
    failedAtStep: info?.failedAtStep ?? null,
    actions: info?.actions ?? null,
    reproduce: `FUZZ_SEED=${details.seed} FUZZ_PATH=${path} ${run}`,
    reproducePowerShell: `$env:FUZZ_SEED=${details.seed}; $env:FUZZ_PATH="${path}"; ${run}`,
  });
  throw new Error(message);
}

/** La cobertura de una corrida, en test-results/fuzz-coverage-<propiedad>.json. */
export function writeCoverage(property: string, coverage: unknown): string {
  mkdirSync(REPORT_DIR, { recursive: true });
  const file = `${REPORT_DIR}fuzz-coverage-${slug(property)}.json`;
  writeFileSync(file, `${JSON.stringify(coverage, null, 2)}\n`);
  return file;
}
