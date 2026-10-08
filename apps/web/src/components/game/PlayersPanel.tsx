import type { PlayerView } from '@gran-negocio/engine';
import type { PublicSeat } from '@gran-negocio/server/protocol';
import { BOARD, tokenColor } from '@gran-negocio/shared';
import { GROUP_COLORS } from '../../game/colors.js';
import { i18n, t } from '../../i18n.js';
import { TokenBadge } from '../ui.js';

/**
 * Los jugadores (SPEC.md §7.4.3): plata, propiedades agrupadas por color,
 * turno y conexión. En celular es una tira horizontal.
 */
export function PlayersPanel({
  view,
  seats,
  me,
}: {
  view: PlayerView;
  seats: readonly PublicSeat[];
  me: string | null;
}) {
  return (
    <ul
      className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
      aria-label={t('lobby.players')}
    >
      {view.players.map((player) => {
        const seat = seats.find((s) => s.playerId === player.id);
        const owned = Object.entries(view.properties)
          .filter(([, p]) => p.ownerId === player.id)
          .map(([index]) => BOARD[Number(index)])
          .filter((tile) => tile !== undefined);
        const isTurn = player.id === view.currentPlayerId && view.phase.kind !== 'gameOver';
        return (
          <li
            key={player.id}
            data-testid={`player-${player.id}`}
            className={`min-w-[11rem] rounded-xl bg-white p-3 ring-2 lg:min-w-0 ${isTurn ? 'ring-sol' : 'ring-transparent'} ${player.bankrupt ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-2">
              <TokenBadge color={tokenColor(player.tokenId)} label={player.name} active={isTurn} />
              <span className="truncate font-bold">
                {player.name}
                {player.id === me && (
                  <span className="font-normal text-tinta/60"> ({t('lobby.you')})</span>
                )}
              </span>
              <span
                className="ml-auto font-display text-lg font-extrabold tabular-nums"
                data-testid={`cash-${player.id}`}
              >
                {i18n.money(player.cash)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 text-sm text-tinta/70">
              {player.inJail && <span>{t('player.inJail')}</span>}
              {player.bankrupt && <span>{t('player.bankrupt')}</span>}
              {seat !== undefined && !seat.connected && !player.bankrupt && (
                <span>{t('player.disconnected')}</span>
              )}
              {player.jailFreeCards.length > 0 && (
                <span>{t('player.jailCards', { count: player.jailFreeCards.length })}</span>
              )}
            </div>
            {owned.length > 0 && (
              <div
                className="mt-2 flex flex-wrap gap-1"
                aria-label={t('player.properties', { count: owned.length })}
              >
                {owned.map((tile) => (
                  <span
                    key={tile.index}
                    title={i18n.tileName(tile, view.rules.useRealBrands)}
                    className={`h-3 w-4 rounded-sm ring-1 ring-tinta/30 ${view.properties[tile.index]?.mortgaged === true ? 'opacity-40' : ''}`}
                    style={{
                      backgroundColor:
                        tile.kind === 'property' ? GROUP_COLORS[tile.group] : '#94a3b8',
                    }}
                  />
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
