/**
 * `pnpm fuzz:loop [corridas] [--workers N] [--seed S]`
 *
 * Corre el fuzz de "partida avanzada" muchas veces (40 casos por corrida, como
 * el test), cada una con otra semilla, repartidas entre varios procesos. Se
 * detiene en la primera falla: el contraejemplo, con su secuencia de acciones
 * y el comando para reproducirlo, queda en test-results/fuzz-failure-*.json.
 *
 * Cada proceso corre packages/engine/test/fuzzLoop.test.ts con su tramo de
 * semillas (FUZZ_LOOP_BASE + FUZZ_LOOP_FROM … + FUZZ_LOOP_COUNT − 1).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { availableParallelism } from 'node:os';

const args = process.argv.slice(2).filter((arg) => arg !== '--');

function option(name: string, fallback: number): number {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(args[index + 1]);
  args.splice(index, 2);
  if (!Number.isFinite(value)) throw new Error(`${name} necesita un número`);
  return value;
}

const workers = Math.max(1, option('--workers', Math.floor(availableParallelism() / 2)));
const base = option('--seed', Math.floor(Math.random() * 2 ** 31));
const runs = Math.max(1, Number(args[0] ?? 200));
const CASES_PER_RUN = 40;
const DETAIL = /seed:|path:|contraejemplo:|error:|acciones|reporte:|reproducir/;

console.log(
  `fuzz:loop — ${String(runs)} corridas × ${String(CASES_PER_RUN)} casos, semillas ` +
    `${String(base)}…${String(base + runs - 1)}, ${String(workers)} procesos`,
);

/** Lo que cada corrida reporta de cobertura (ver packages/engine/test/scenarios.ts). */
interface RunCoverage {
  readonly cases: number;
  readonly hits: Record<string, number>;
  readonly gaps: readonly string[];
}

const LABELS: Readonly<Record<string, string>> = {
  houses: 'construyeron casas',
  hotel: 'llegaron a hotel',
  soldBuilding: 'vendieron edificios',
  mortgagedBuiltGroup: 'hipotecaron un grupo con edificios',
  scarcityAuction: 'subasta por escasez de casas',
  bankruptcy: 'quiebra',
};

const coverages: RunCoverage[] = [];
const warnings: string[] = [];

function recordCoverage(line: string): void {
  const run = /corrida=(\d+) seed=(\d+)/.exec(line);
  const json = line.slice(line.indexOf('cobertura=') + 'cobertura='.length);
  const coverage = JSON.parse(json) as RunCoverage;
  coverages.push(coverage);
  if (coverage.gaps.length > 0) {
    warnings.push(
      `  ADVERTENCIA corrida ${run?.[1] ?? '?'} (seed ${run?.[2] ?? '?'}): ningún caso ` +
        coverage.gaps.map((key) => LABELS[key] ?? key).join(', '),
    );
  }
}

function printCoverage(): void {
  if (coverages.length === 0) return;
  const cases = coverages.reduce((sum, run) => sum + run.cases, 0);
  console.log(`\nCobertura (${String(coverages.length)} corridas, ${String(cases)} casos):`);
  for (const [key, label] of Object.entries(LABELS)) {
    const total = coverages.reduce((sum, run) => sum + (run.hits[key] ?? 0), 0);
    const perRun = coverages.map((run) => run.hits[key] ?? 0);
    const zero = perRun.filter((hits) => hits === 0).length;
    console.log(
      `  ${label.padEnd(36)} ${String(total).padStart(6)} casos (${((100 * total) / cases).toFixed(1)} %)` +
        ` · mínimo por corrida ${String(Math.min(...perRun))}/40 · corridas en cero: ${String(zero)}`,
    );
  }
  if (warnings.length > 0) {
    console.log(`\n${String(warnings.length)} corridas con algo en cero:`);
    for (const warning of warnings) console.log(warning);
  } else {
    console.log('\nNinguna corrida dejó una categoría en cero.');
  }
}

const children: ChildProcess[] = [];
const started = Date.now();
const seconds = () => Math.round((Date.now() - started) / 1000);
let done = 0;
let failure: string | null = null;
let finished = false;

function stopAll(except: ChildProcess | null): void {
  for (const child of children) if (child !== except) child.kill();
}

const per = Math.ceil(runs / workers);
for (let w = 0; w < workers; w += 1) {
  const from = w * per;
  const count = Math.min(per, runs - from);
  if (count <= 0) break;
  const child = spawn(
    'pnpm',
    [
      'exec',
      'vitest',
      'run',
      '--project',
      'engine',
      'test/fuzzLoop.test.ts',
      '--disable-console-intercept',
      '--reporter=dot',
    ],
    {
      env: {
        ...process.env,
        FUZZ_LOOP_BASE: String(base),
        FUZZ_LOOP_FROM: String(from),
        FUZZ_LOOP_COUNT: String(count),
      },
      shell: process.platform === 'win32',
    },
  );
  children.push(child);
  let pending = '';
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    output += text;
    pending += text;
    let newline = pending.indexOf('\n');
    while (newline >= 0) {
      const line = pending.slice(0, newline);
      pending = pending.slice(newline + 1);
      if (line.startsWith('LOOP OK')) {
        done += 1;
        recordCoverage(line);
        if (done % 10 === 0) {
          console.log(
            `  ${String(done)}/${String(runs)} corridas sin fallas (${String(seconds())} s)`,
          );
        }
      } else if (line.startsWith('LOOP FAIL')) {
        failure ??= line.replace('LOOP FAIL ', '').replace(/ cobertura=.*/, '');
      }
      newline = pending.indexOf('\n');
    }
  });
  child.stderr.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.on('exit', (code) => {
    if (code === 0 || finished) return;
    finished = true;
    if (failure !== null) {
      console.log(`\nFALLA en ${failure}, después de ${String(done)} corridas sin fallas:`);
      for (const line of output.split('\n')) if (DETAIL.test(line)) console.log(line.trimEnd());
      printCoverage();
      process.exitCode = 1;
    } else {
      console.log(output);
      console.log('Un proceso terminó con error sin una falla del fuzz (ver arriba).');
      process.exitCode = 2;
    }
    stopAll(child);
  });
}

process.on('exit', () => {
  if (process.exitCode === undefined || process.exitCode === 0) {
    printCoverage();
    console.log(
      `\nOK: ${String(done)} corridas (${String(done * CASES_PER_RUN)} casos) sin fallas en ${String(seconds())} s.`,
    );
  }
});
