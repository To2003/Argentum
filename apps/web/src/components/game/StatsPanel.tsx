import type { GameStats, PlayerView } from '@gran-negocio/engine';
import { BOARD, tokenColor } from '@gran-negocio/shared';
import { i18n, t } from '../../i18n.js';

/** Trazos distintos por jugador: el gráfico no depende solo del color (SPEC.md §7.7). */
const DASHES = ['', '6 4', '2 3', '10 4 2 4', '1 5', '14 6'];
const MARKERS = ['circle', 'square', 'diamond', 'triangle', 'circle', 'square'] as const;

const WIDTH = 320;
const HEIGHT = 160;
const PAD = { left: 44, right: 8, top: 8, bottom: 22 };

/**
 * Las estadísticas de fin de partida (SPEC.md §5.8): patrimonio por ronda,
 * propiedades más rentables, plata cobrada y pagada, veces preso y la casilla
 * más pisada.
 */
export function StatsPanel({ stats, view }: { stats: GameStats; view: PlayerView }) {
  const tileName = (index: number) => {
    const tile = BOARD[index];
    return tile === undefined ? '' : i18n.tileName(tile, view.rules.useRealBrands);
  };
  const topRent = Object.entries(stats.rentByTile)
    .map(([tile, amount]) => ({ tile: Number(tile), amount }))
    .sort((a, b) => b.amount - a.amount || a.tile - b.tile)
    .slice(0, 3);
  const mostLanded = stats.landings.reduce(
    (best, count, tile) => (count > best.count ? { tile, count } : best),
    { tile: 0, count: 0 },
  );

  return (
    <section aria-labelledby="stats-title" className="mt-5" data-testid="stats">
      <h3 id="stats-title" className="font-display text-xl font-extrabold">
        {t('stats.title')}
      </h3>
      <WorthChart stats={stats} view={view} />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm tabular-nums">
          <thead>
            <tr className="border-b border-tinta/15">
              <th scope="col" className="py-1 pr-2">
                {t('stats.player')}
              </th>
              <th scope="col" className="py-1 pr-2 text-right">
                {t('stats.collected')}
              </th>
              <th scope="col" className="py-1 pr-2 text-right">
                {t('stats.paid')}
              </th>
              <th scope="col" className="py-1 pr-2 text-right">
                {t('stats.rentCollected')}
              </th>
              <th scope="col" className="py-1 text-right">
                {t('stats.jail')}
              </th>
            </tr>
          </thead>
          <tbody>
            {view.players.map((player) => {
              const own = stats.players[player.id];
              if (own === undefined) return null;
              return (
                <tr key={player.id} className="border-b border-tinta/5">
                  <th scope="row" className="py-1 pr-2 font-bold">
                    {player.name}
                  </th>
                  <td className="py-1 pr-2 text-right">{i18n.money(own.collected)}</td>
                  <td className="py-1 pr-2 text-right">{i18n.money(own.paid)}</td>
                  <td className="py-1 pr-2 text-right">{i18n.money(own.rentCollected)}</td>
                  <td className="py-1 text-right">{i18n.number(own.jailVisits)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="font-bold">{t('stats.topProperties')}</h4>
          {topRent.length === 0 ? (
            <p className="text-sm text-tinta/70">{t('stats.noRent')}</p>
          ) : (
            <ol className="mt-1 list-decimal pl-5 text-sm">
              {topRent.map(({ tile, amount }) => (
                <li key={tile}>
                  {tileName(tile)}: <span className="tabular-nums">{i18n.money(amount)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <h4 className="font-bold">{t('stats.mostLanded')}</h4>
          <p className="mt-1 text-sm">
            {mostLanded.count === 0
              ? '—'
              : `${tileName(mostLanded.tile)} (${t('stats.landedTimes', { count: mostLanded.count })})`}
          </p>
        </div>
      </div>
    </section>
  );
}

function WorthChart({ stats, view }: { stats: GameStats; view: PlayerView }) {
  const points = stats.worthByRound;
  const max = Math.max(1, ...points.flatMap((point) => Object.values(point.worth)));
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length <= 1 ? 0 : (i / (points.length - 1)) * plotW);
  const y = (value: number) => PAD.top + plotH - (value / max) * plotH;
  const last = points.at(-1);
  const summary = view.players
    .map((player) => `${player.name}: ${i18n.money(last?.worth[player.id] ?? 0)}`)
    .join(', ');

  return (
    <figure className="mt-3">
      <figcaption className="mb-1 font-bold">{t('stats.worthChart')}</figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${t('stats.worthChart')}. ${summary}`}
        className="w-full"
      >
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(max * fraction)}
              y2={y(max * fraction)}
              stroke="currentColor"
              strokeOpacity={0.15}
            />
            <text
              x={PAD.left - 4}
              y={y(max * fraction) + 3}
              textAnchor="end"
              fontSize={9}
              fill="currentColor"
            >
              {i18n.money(Math.round(max * fraction))}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={HEIGHT - 6} fontSize={9} fill="currentColor">
          {t('stats.round')} {points[0]?.round ?? 1}
        </text>
        <text
          x={WIDTH - PAD.right}
          y={HEIGHT - 6}
          fontSize={9}
          textAnchor="end"
          fill="currentColor"
        >
          {t('stats.round')} {last?.round ?? 1}
        </text>
        {view.players.map((player, index) => {
          const path = points
            .map(
              (point, i) =>
                `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(point.worth[player.id] ?? 0).toFixed(1)}`,
            )
            .join(' ');
          const endY = y(last?.worth[player.id] ?? 0);
          return (
            <g key={player.id} color={tokenColor(player.tokenId)}>
              <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeDasharray={DASHES[index % DASHES.length]}
              />
              <Marker
                kind={MARKERS[index % MARKERS.length] ?? 'circle'}
                cx={x(points.length - 1)}
                cy={endY}
              />
            </g>
          );
        })}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {view.players.map((player, index) => (
          <li key={player.id} className="flex items-center gap-1.5">
            <svg width="26" height="10" aria-hidden="true" color={tokenColor(player.tokenId)}>
              <line
                x1="0"
                x2="18"
                y1="5"
                y2="5"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={DASHES[index % DASHES.length]}
              />
              <Marker kind={MARKERS[index % MARKERS.length] ?? 'circle'} cx={21} cy={5} />
            </svg>
            {player.name}
          </li>
        ))}
      </ul>
    </figure>
  );
}

function Marker({ kind, cx, cy }: { kind: (typeof MARKERS)[number]; cx: number; cy: number }) {
  const r = 3.5;
  switch (kind) {
    case 'square':
      return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill="currentColor" />;
    case 'diamond':
      return (
        <polygon
          points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
          fill="currentColor"
        />
      );
    case 'triangle':
      return (
        <polygon
          points={`${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`}
          fill="currentColor"
        />
      );
    case 'circle':
      return <circle cx={cx} cy={cy} r={r} fill="currentColor" />;
  }
}
