/**
 * `pnpm sim`: corre el simulador de balance y escribe docs/balance-report.md
 * (SPEC.md §9). Opciones: --games N (por enfrentamiento), --max-turns N.
 */
import { writeFileSync } from 'node:fs';
import { BOARD, createTranslator } from '@gran-negocio/shared';
import { runMatchup, type MatchupReport } from './simulate.js';

const arg = (name: string, fallback: number): number => {
  const index = process.argv.indexOf(`--${name}`);
  const value = index === -1 ? NaN : Number(process.argv[index + 1]);
  return Number.isFinite(value) ? value : fallback;
};

const GAMES = arg('games', 1000);
const MAX_TURNS = arg('max-turns', 400);
const SEED_BASE = '6772616e6e65676f63696f00000000';
const i18n = createTranslator('es-AR');
const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(1)} %`;

const matchups = [
  { label: 'Medio vs. Fácil (aceptación de M8)', seats: ['medium', 'easy'] },
  { label: 'Difícil vs. Medio', seats: ['hard', 'medium'] },
  { label: 'Difícil vs. Fácil', seats: ['hard', 'easy'] },
  { label: 'Cuatro: Difícil, Medio, Fácil, Fácil', seats: ['hard', 'medium', 'easy', 'easy'] },
] as const;

const started = Date.now();
const reports: MatchupReport[] = matchups.map((matchup) => {
  const report = runMatchup(matchup, GAMES, SEED_BASE, MAX_TURNS);
  console.log(`${matchup.label}: ${JSON.stringify(report.winsByDifficulty)}`);
  return report;
});

const lines: string[] = [];
lines.push('# Reporte de balance');
lines.push('');
lines.push(
  `Generado con \`pnpm sim\`: ${GAMES} partidas por enfrentamiento, tope de ${MAX_TURNS} turnos, ` +
    `seeds desde \`${SEED_BASE}\`, reglas por defecto. Los bots son deterministas: el reporte se ` +
    `reproduce exacto. Una partida que llega al tope se decide por patrimonio neto (§5.8). ` +
    `Los asientos rotan en cada partida.`,
);
lines.push('');
lines.push('## Resultados por enfrentamiento');
lines.push('');
lines.push(
  '| Enfrentamiento | Victorias | Solo partidas terminadas | Turnos promedio | Llegan al tope |',
);
lines.push('|---|---|---|---|---|');
for (const report of reports) {
  const finished = report.results.filter((r) => r.finished);
  const by = (results: typeof report.results) => {
    const counts: Record<string, number> = {};
    for (const r of results) {
      const d = r.seats[r.winnerSeat] ?? '?';
      counts[d] = (counts[d] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([d, n]) => `${d} ${pct(n, results.length)}`)
      .join(', ');
  };
  lines.push(
    `| ${report.label} | ${by(report.results)} | ${by(finished)} (${finished.length}) | ${report.averageTurns.toFixed(0)} | ${pct(report.unfinishedRate * report.games, report.games)} |`,
  );
}
const acceptance = reports[0];
const mediumRate = (acceptance?.winsByDifficulty.medium ?? 0) / Math.max(1, acceptance?.games ?? 1);
lines.push('');
lines.push(
  `**Aceptación de M8** (Medio le gana al Fácil en más del 65 %): ${(mediumRate * 100).toFixed(1)} % → ${mediumRate > 0.65 ? '✅' : '❌'}`,
);

lines.push('');
lines.push('## Ventaja por orden de turno');
lines.push('');
lines.push('Victorias según en qué lugar del orden de turno jugó el ganador.');
lines.push('');
lines.push('| Enfrentamiento | 1.º | 2.º | 3.º | 4.º |');
lines.push('|---|---|---|---|---|');
for (const report of reports) {
  const cells = [0, 1, 2, 3].map((i) =>
    i < report.winsByTurnPosition.length
      ? pct(report.winsByTurnPosition[i] ?? 0, report.games)
      : '—',
  );
  lines.push(`| ${report.label} | ${cells.join(' | ')} |`);
}

const all = reports.flatMap((r) => r.results);
const landings = BOARD.map((tile) => ({
  tile,
  count: all.reduce((sum, r) => sum + (r.landings[tile.index] ?? 0), 0),
}));
const totalLandings = landings.reduce((sum, l) => sum + l.count, 0);
lines.push('');
lines.push('## Casillas más pisadas');
lines.push('');
lines.push('| Casilla | % de las caídas |');
lines.push('|---|---|');
for (const { tile, count } of [...landings].sort((a, b) => b.count - a.count).slice(0, 10)) {
  lines.push(`| ${tile.index} · ${i18n.tileName(tile, true)} | ${pct(count, totalLandings)} |`);
}

const rent: Record<string, number> = {};
const invested: Record<string, number> = {};
for (const r of all) {
  for (const [k, v] of Object.entries(r.rentByGroup)) rent[k] = (rent[k] ?? 0) + v;
  for (const [k, v] of Object.entries(r.investedByGroup)) invested[k] = (invested[k] ?? 0) + v;
}
lines.push('');
lines.push('## Retorno por grupo');
lines.push('');
lines.push(
  'Alquiler cobrado sobre lo invertido (compras, subastas y edificios netos de ventas), en todas las partidas.',
);
lines.push('');
lines.push('| Grupo | Alquiler cobrado | Invertido | Retorno |');
lines.push('|---|---|---|---|');
for (const key of Object.keys(invested).sort(
  (a, b) => (rent[b] ?? 0) / (invested[b] ?? 1) - (rent[a] ?? 0) / (invested[a] ?? 1),
)) {
  const name = i18n.has(`group.${key}`)
    ? i18n.translate(`group.${key}`)
    : key === 'subway'
      ? 'Subtes'
      : 'Servicios';
  lines.push(
    `| ${name} | ${i18n.money(rent[key] ?? 0)} | ${i18n.money(invested[key] ?? 0)} | ${((rent[key] ?? 0) / Math.max(1, invested[key] ?? 1)).toFixed(2)} |`,
  );
}

lines.push('');
lines.push('## Estancamientos y ajustes propuestos (no activados)');
lines.push('');
lines.push(
  'Las partidas que llegan al tope son las que nadie arma un grupo y construye: con dos ' +
    'jugadores que se reparten los grupos sin trocar, los alquileres base no alcanzan para ' +
    'quebrar a nadie. Pasa mucho más con el bot Fácil (no construye ni comercia). Ajustes ' +
    'posibles, todos opcionales y apagados por defecto:',
);
lines.push('');
lines.push(
  '1. **Tope de rondas con desempate por patrimonio**: ya existe (`maxRounds`); sugerirlo en el lobby para partidas de 2.',
);
lines.push(
  '2. **Impuesto creciente**: Ganancias sube un 10 % cada 10 rondas, para drenar el efectivo acumulado.',
);
lines.push(
  '3. **Subasta forzada de propiedades sueltas** después de N rondas, para que se armen grupos.',
);
lines.push(
  '4. **Bot Medio/Difícil más dispuestos a trocar**: con dos jugadores, el trueque es lo que destraba los grupos.',
);
lines.push('');
lines.push(`_Tiempo de simulación: ${((Date.now() - started) / 1000).toFixed(0)} s._`);

writeFileSync(new URL('../../../docs/balance-report.md', import.meta.url), `${lines.join('\n')}\n`);
console.log('docs/balance-report.md escrito');
if (mediumRate <= 0.65) process.exitCode = 1;
