import type { PlayerView } from '@gran-negocio/engine';
import { tokenColor } from '@gran-negocio/shared';
import { tileCenter } from '../../game/boardLayout.js';
import { TokenBadge } from '../ui.js';

/** Corrimiento de cada ficha cuando comparten casilla (en % del tablero; la ficha mide ~3 %). */
const OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [2.6, 0],
  [-2.6, 0],
  [1.3, -2.4],
  [-1.3, -2.4],
  [0, 2.4],
];

/**
 * Las fichas, dibujadas encima del tablero en la posición que dice la
 * animación (que va detrás del estado real hasta terminar de saltar). Cada
 * cambio de casilla es un salto con arco (`token-hop`); con movimiento
 * reducido, el CSS lo anula.
 */
export function TokenLayer({
  view,
  positions,
  jailed,
}: {
  view: PlayerView;
  positions: Readonly<Record<string, number>>;
  jailed: string | null;
}) {
  // Los quebrados se quedan, invisibles, para desvanecerse en vez de desaparecer de golpe.
  const active = view.players;
  const slot = new Map<number, number>();
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {active.map((player) => {
        const position = positions[player.id] ?? player.position;
        const inJail = player.inJail && position === 10;
        const key = position * 2 + (inJail ? 1 : 0);
        const index = slot.get(key) ?? 0;
        slot.set(key, index + 1);
        const center = tileCenter(position, inJail);
        const [dx, dy] = OFFSETS[index % OFFSETS.length] ?? [0, 0];
        return (
          <div
            key={player.id}
            className={`token-move absolute ${player.bankrupt ? 'token-gone' : ''}`}
            data-token={player.id}
            data-position={position}
            style={{
              left: `calc(${center.x + dx}% - 1.5cqw)`,
              top: `calc(${center.y + dy}% - 1.5cqw)`,
            }}
          >
            <div key={position} className={jailed === player.id ? 'token-jail' : 'token-hop'}>
              <TokenBadge
                color={tokenColor(player.tokenId)}
                label={player.name}
                size="3cqw"
                active={player.id === view.currentPlayerId}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
