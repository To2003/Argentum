import type { PlayerView } from '@gran-negocio/engine';
import { BOARD, tokenColor, type Tile as TileData } from '@gran-negocio/shared';
import type { ReactNode } from 'react';
import { placement } from '../../game/boardLayout.js';
import { GROUP_COLORS } from '../../game/colors.js';
import { i18n, t } from '../../i18n.js';
import { TokenBadge } from '../ui.js';

/**
 * El tablero 11 × 11 (SPEC.md §4.1). Cada casilla es un botón que abre su
 * detalle; el centro queda libre para lo que pasa en la partida.
 */
export function Board({
  view,
  onTile,
  center,
}: {
  view: PlayerView;
  onTile: (index: number) => void;
  center: ReactNode;
}) {
  return (
    <div
      className="board w-full rounded-[2%] bg-tablero p-[0.4%] shadow-[0_10px_30px_-12px_rgba(20,40,58,0.45)]"
      data-testid="board"
    >
      {BOARD.map((tile) => (
        <Tile
          key={tile.index}
          tile={tile}
          view={view}
          onClick={() => {
            onTile(tile.index);
          }}
        />
      ))}
      <div
        className="relative flex flex-col items-center justify-center gap-[1.5cqw] overflow-hidden p-[2cqw]"
        style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}
      >
        {center}
      </div>
    </div>
  );
}

function Tile({ tile, view, onClick }: { tile: TileData; view: PlayerView; onClick: () => void }) {
  const place = placement(tile.index);
  const owned = view.properties[tile.index];
  const owner = owned === undefined ? undefined : view.players.find((p) => p.id === owned.ownerId);
  const here = view.players.filter((player) => player.position === tile.index && !player.bankrupt);
  const name = i18n.tileName(tile, view.rules.useRealBrands);
  const price =
    'price' in tile ? i18n.money(tile.price) : 'amount' in tile ? i18n.money(tile.amount) : '';
  const band = tile.kind === 'property' ? GROUP_COLORS[tile.group] : null;
  const corner = place.side === 'corner';
  const houses = owned?.houses ?? 0;

  const label = [
    name,
    owner === undefined ? null : `${t('tileInfo.owner')}: ${owner.name}`,
    owned?.mortgaged === true ? t('tileInfo.mortgaged') : null,
    ...here.map((player) => player.name),
  ]
    .filter((part) => part !== null)
    .join(', ');

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-tile={tile.index}
      className="relative overflow-hidden border-[0.12cqw] border-tinta/25 bg-white text-tinta transition hover:z-10 hover:brightness-95 focus-visible:z-10"
      style={{
        gridRow: place.row,
        gridColumn: place.col,
        boxShadow:
          owner === undefined ? undefined : `inset 0 0 0 0.45cqw ${tokenColor(owner.tokenId)}`,
      }}
    >
      <span
        className="tile-inner flex flex-col items-center"
        data-corner={corner}
        style={{ transform: `translate(-50%, -50%) rotate(${place.rotation}deg)` }}
      >
        {band !== null && (
          <span
            className="flex h-[22%] w-full items-center justify-center gap-[0.3cqw]"
            style={{ backgroundColor: band }}
          >
            {houses === 5 ? (
              <span className="h-[1.6cqw] w-[3.4cqw] rounded-[0.3cqw] bg-fileteado ring-[0.15cqw] ring-white" />
            ) : (
              Array.from({ length: houses }, (_, i) => (
                <span
                  key={i}
                  className="h-[1.3cqw] w-[1.3cqw] rounded-[0.2cqw] bg-ganancia ring-[0.15cqw] ring-white"
                />
              ))
            )}
          </span>
        )}
        <span
          className={`flex flex-1 flex-col items-center px-[0.4cqw] py-[0.5cqw] text-center leading-tight ${corner ? 'justify-center gap-[1cqw]' : 'justify-between'}`}
        >
          <span
            className={`line-clamp-3 font-bold hyphens-auto ${corner ? 'font-display text-[1.7cqw]' : 'tile-text text-[1.05cqw]'}`}
            lang="es"
          >
            {name}
          </span>
          {here.length > 0 && (
            <span className="flex flex-wrap justify-center gap-[0.2cqw]">
              {here.map((player) => (
                <TokenBadge
                  key={player.id}
                  color={tokenColor(player.tokenId)}
                  label={player.name}
                  size="2.4cqw"
                  active={player.id === view.currentPlayerId}
                />
              ))}
            </span>
          )}
          {price !== '' && <span className="tile-text text-[1cqw] tabular-nums">{price}</span>}
        </span>
        {owned?.mortgaged === true && (
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(20,40,58,0.18)_0_0.5cqw,transparent_0.5cqw_1.2cqw)]"
          />
        )}
      </span>
    </button>
  );
}
