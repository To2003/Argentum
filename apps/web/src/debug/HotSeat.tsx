/**
 * Hot-seat interno para jugar el engine a mano, sin red (M2).
 *
 * Solo existe en dev: App lo carga con lazy() detrás de
 * `import.meta.env.DEV && ?debug=1`, así que el build de producción ni
 * siquiera emite este chunk. Es una herramienta de desarrollo: sus etiquetas
 * no pasan por i18n (excepción documentada en SPEC §15.4).
 */
import {
  actorOf,
  applyAction,
  createGame,
  legalActions,
  toPlayerView,
  type Action,
  type GameEvent,
  type GameState,
} from '@gran-negocio/engine';
import { BOARD, createTranslator, DEFAULT_RULES } from '@gran-negocio/shared';
import { useState } from 'react';

const i18n = createTranslator('es-AR');
const NAMES = ['Ana', 'Beto', 'Caro', 'Dani', 'Eli', 'Fede'];

const randomSeed = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

interface Entry {
  readonly seq: number;
  readonly event: GameEvent;
}

interface Session {
  readonly seed: string;
  readonly state: GameState;
  readonly entries: readonly Entry[];
  readonly log: readonly { readonly playerId: string; readonly action: Action }[];
}

function start(seed: string, players: number): Session {
  const { state, events } = createGame({
    seed,
    rules: DEFAULT_RULES,
    players: NAMES.slice(0, players).map((name, i) => ({
      id: `p${i + 1}`,
      name,
      tokenId: `token${i + 1}`,
    })),
  });
  return { seed, state, entries: events.map((event, seq) => ({ seq, event })), log: [] };
}

function step(session: Session, playerId: string, action: Action): Session | string {
  const result = applyAction(session.state, playerId, action);
  if (!result.ok) return result.error;
  const base = session.entries.length;
  return {
    seed: session.seed,
    state: result.state,
    entries: [...session.entries, ...result.events.map((event, i) => ({ seq: base + i, event }))],
    log: [...session.log, { playerId, action }],
  };
}

export default function HotSeat() {
  const [seedInput, setSeedInput] = useState('');
  const [players, setPlayers] = useState(3);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<string>('state');

  const play = (playerId: string, action: Action) => {
    if (session === null) return;
    const next = step(session, playerId, action);
    if (typeof next === 'string') setError(next);
    else {
      setError(null);
      setSession(next);
    }
  };

  const auto = (count: number) => {
    if (session === null) return;
    let current = session;
    for (let i = 0; i < count; i += 1) {
      const actor = actorOf(current.state);
      if (actor === null) break;
      const legal = legalActions(current.state, actor);
      const action = legal[Math.floor(Math.random() * legal.length)];
      if (action === undefined) break;
      const next = step(current, actor, action);
      if (typeof next === 'string') {
        setError(next);
        break;
      }
      current = next;
    }
    setSession(current);
  };

  const newGame = () => {
    const seed = seedInput.trim() === '' ? randomSeed() : seedInput.trim().toLowerCase();
    try {
      setSession(start(seed, players));
      setError(null);
    } catch (thrown) {
      setError(String(thrown));
    }
  };

  const state = session?.state;
  const actor = state === undefined ? null : actorOf(state);
  const shown =
    state === undefined ? null : viewer === 'state' ? state : toPlayerView(state, viewer);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4 font-mono text-sm">
      <h1 className="text-xl font-bold">Hot-seat de debug (engine M2)</h1>

      <section className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col">
          seed (vacío = al azar)
          <input
            aria-label="seed"
            className="w-80 rounded border px-2 py-1"
            value={seedInput}
            onChange={(e) => {
              setSeedInput(e.target.value);
            }}
          />
        </label>
        <label className="flex flex-col">
          jugadores
          <select
            aria-label="jugadores"
            className="rounded border px-2 py-1"
            value={players}
            onChange={(e) => {
              setPlayers(Number(e.target.value));
            }}
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="rounded bg-noche px-3 py-1 text-white" onClick={newGame}>
          Nueva partida
        </button>
        {session !== null && (
          <span>
            seed: <code>{session.seed}</code> · v{state?.version} · turno {state?.turnNumber}
          </span>
        )}
      </section>

      {error !== null && <p className="rounded bg-red-100 p-2 text-red-800">Rechazada: {error}</p>}

      {state !== undefined && (
        <>
          <section className="flex flex-wrap items-center gap-2">
            <strong>
              Actúa: {actor ?? '—'} · fase {state.phase.kind}
            </strong>
            {actor !== null &&
              legalActions(state, actor).map((action) => (
                <button
                  key={action.type}
                  type="button"
                  className="rounded bg-celeste px-3 py-1 font-bold"
                  onClick={() => {
                    play(actor, action);
                  }}
                >
                  {action.type}
                </button>
              ))}
            <button
              type="button"
              className="rounded border px-3 py-1"
              onClick={() => {
                auto(10);
              }}
            >
              Auto ×10
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1"
              onClick={() => {
                auto(200);
              }}
            >
              Auto ×200
            </button>
          </section>

          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b">
                <th>orden</th>
                <th>jugador</th>
                <th>plata</th>
                <th>casilla</th>
                <th>cárcel</th>
                <th>"Salí gratis"</th>
                <th>propiedades</th>
              </tr>
            </thead>
            <tbody>
              {state.turnOrder.map((id, position) => {
                const player = state.players[id];
                if (player === undefined) return null;
                const tile = BOARD[player.position];
                const owned = Object.entries(state.properties)
                  .filter(([, p]) => p.ownerId === id)
                  .map(([index]) => {
                    const t = BOARD[Number(index)];
                    return t === undefined ? index : i18n.tileName(t, true);
                  });
                return (
                  <tr
                    key={id}
                    className={`border-b ${id === state.currentPlayerId ? 'bg-dorado/30' : ''} ${player.bankrupt ? 'line-through opacity-50' : ''}`}
                  >
                    <td>{position + 1}</td>
                    <td>
                      {player.name} ({id})
                    </td>
                    <td>{i18n.money(player.cash)}</td>
                    <td>
                      {player.position} · {tile === undefined ? '?' : i18n.tileName(tile, true)}
                    </td>
                    <td>{player.inJail ? `sí (${player.jailAttempts})` : 'no'}</td>
                    <td>{player.jailFreeCards.join(', ')}</td>
                    <td>{owned.join(', ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="grid gap-4 lg:grid-cols-2">
            <section>
              <div className="mb-1 flex items-center gap-2">
                <strong>Estado</strong>
                <select
                  aria-label="vista"
                  className="rounded border px-1"
                  value={viewer}
                  onChange={(e) => {
                    setViewer(e.target.value);
                  }}
                >
                  <option value="state">GameState completo (server)</option>
                  {state.turnOrder.map((id) => (
                    <option key={id} value={id}>
                      PlayerView de {id}
                    </option>
                  ))}
                </select>
              </div>
              <pre className="max-h-[60vh] overflow-auto rounded bg-white p-2 text-xs">
                {JSON.stringify(shown, null, 2)}
              </pre>
            </section>
            <section>
              <strong>Eventos ({session?.entries.length ?? 0}, el último arriba)</strong>
              <pre
                data-testid="events"
                className="max-h-[60vh] overflow-auto rounded bg-white p-2 text-xs"
              >
                {[...(session?.entries ?? [])]
                  .reverse()
                  .slice(0, 300)
                  .map((entry) => `${entry.seq} ${JSON.stringify(entry.event)}`)
                  .join('\n')}
              </pre>
              <details className="mt-2">
                <summary>Log de acciones (replay: seed + esto)</summary>
                <pre className="max-h-64 overflow-auto rounded bg-white p-2 text-xs">
                  {JSON.stringify({ seed: session?.seed, actions: session?.log }, null, 2)}
                </pre>
              </details>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
