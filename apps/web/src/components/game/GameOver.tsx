import type { GameEvent, PlayerView } from '@gran-negocio/engine';
import { tokenColor } from '@gran-negocio/shared';
import { i18n, t } from '../../i18n.js';
import { TokenBadge } from '../ui.js';

/** Fin de partida: quién ganó, por qué y el patrimonio de cada uno (SPEC.md §5.8). */
export function GameOver({ view, events }: { view: PlayerView; events: readonly GameEvent[] }) {
  if (view.phase.kind !== 'gameOver') return null;
  const { winnerId, reason } = view.phase;
  const winner = view.players.find((p) => p.id === winnerId);
  const final = [...events].reverse().find((event) => event.type === 'gameOver');
  const worth = final?.type === 'gameOver' ? final.netWorth : {};
  const ranking = [...view.players].sort(
    (a, b) => (worth[b.id] ?? b.cash) - (worth[a.id] ?? a.cash),
  );
  return (
    <section className="rounded-xl bg-white p-5" data-testid="game-over">
      <h2 className="font-display text-3xl font-extrabold">
        {winner === undefined
          ? t('event.gameOverNone')
          : t('gameOver.title', { name: winner.name })}
      </h2>
      <p className="mt-1 text-tinta/70">{t(`gameOver.reason.${reason}`)}</p>
      <ol className="mt-4 space-y-2">
        {ranking.map((player) => (
          <li key={player.id} className="flex items-center gap-2">
            <TokenBadge color={tokenColor(player.tokenId)} label={player.name} />
            <span className={player.bankrupt ? 'line-through opacity-60' : ''}>{player.name}</span>
            <span className="ml-auto tabular-nums">
              {t('gameOver.netWorth')}: {i18n.money(worth[player.id] ?? 0)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
