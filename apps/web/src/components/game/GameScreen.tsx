import type { Action } from '@gran-negocio/engine';
import { useState } from 'react';
import { t } from '../../i18n.js';
import { useGame } from '../../store/game.js';
import { Button } from '../ui.js';
import { ActionPanel } from './ActionPanel.js';
import { Board } from './Board.js';
import { BoardCenter } from './BoardCenter.js';
import { EventLog } from './EventLog.js';
import { GameOver } from './GameOver.js';
import { PlayersPanel } from './PlayersPanel.js';
import { TileDialog } from './TileDialog.js';

/**
 * La partida (SPEC.md §7.4.3). En escritorio: tablero a la izquierda y la
 * columna de jugadores, acciones y registro a la derecha. En celular: el
 * tablero arriba (con zoom a la propia ficha) y el panel de acciones fijo abajo.
 */
export function GameScreen() {
  const view = useGame((state) => state.view);
  const room = useGame((state) => state.room);
  const timers = useGame((state) => state.timers);
  const log = useGame((state) => state.log);
  const act = useGame((state) => state.act);
  const [tile, setTile] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);

  if (view === null || room === null) return null;
  const me = view.viewerId;
  const mine = view.players.find((player) => player.id === me);
  const onAct = (action: Action) => {
    void act(action);
  };

  return (
    <div className="mx-auto grid max-w-[1400px] gap-4 p-4 pb-48 lg:grid-cols-[minmax(0,1fr)_24rem] lg:pb-4">
      <div className="flex flex-col gap-2">
        <div
          className={`relative mx-auto w-full ${zoomed ? 'overflow-auto' : ''}`}
          style={{ maxWidth: 'min(100%, calc(100dvh - 2rem))' }}
        >
          <div style={{ width: zoomed ? '220%' : '100%' }}>
            <Board view={view} onTile={setTile} center={<BoardCenter view={view} />} />
          </div>
        </div>
        {mine !== undefined && (
          <Button
            variant="quiet"
            className="self-center lg:hidden"
            onClick={() => {
              setZoomed((value) => !value);
              if (!zoomed) {
                // Llevar la vista a la ficha propia.
                requestAnimationFrame(() => {
                  document.querySelector(`[data-tile="${mine.position}"]`)?.scrollIntoView({
                    block: 'center',
                    inline: 'center',
                  });
                });
              }
            }}
          >
            {zoomed ? t('game.zoomOut') : t('game.zoomIn')}
          </Button>
        )}
      </div>

      <aside className="flex flex-col gap-4">
        <PlayersPanel view={view} seats={room.seats} me={me} />
        <GameOver view={view} events={log.map((entry) => entry.event)} />
        {view.phase.kind !== 'gameOver' && (
          <div className="fixed inset-x-0 bottom-0 z-20 max-h-[45dvh] overflow-y-auto border-t border-tinta/10 bg-papel p-3 shadow-[0_-8px_24px_-12px_rgba(20,40,58,0.35)] lg:static lg:max-h-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <ActionPanel view={view} timers={timers} onAct={onAct} />
          </div>
        )}
        <EventLog log={log} view={view} />
      </aside>

      {tile !== null && (
        <TileDialog
          index={tile}
          view={view}
          onAct={onAct}
          onClose={() => {
            setTile(null);
          }}
        />
      )}
    </div>
  );
}
