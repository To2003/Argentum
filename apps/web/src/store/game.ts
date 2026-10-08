import type { Action, GameEvent, PlayerView } from '@gran-negocio/engine';
import type {
  Ack,
  RoomState,
  ServerError,
  Session,
  TimerState,
} from '@gran-negocio/server/protocol';
import type { RulesOverrides } from '@gran-negocio/shared';
import { create } from 'zustand';
import { getSocket } from '../net/client.js';
import { forgetSession, saveSession } from '../net/session.js';

/** Un evento con número, para listas y animaciones. */
export interface LoggedEvent {
  readonly id: number;
  readonly event: GameEvent;
}

/** Cuántos eventos guarda el cliente para el registro. */
const LOG_LIMIT = 200;

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting';

interface GameStore {
  status: ConnectionStatus;
  session: Session | null;
  room: RoomState | null;
  view: PlayerView | null;
  timers: readonly TimerState[];
  log: readonly LoggedEvent[];
  /** El último error de una acción, para mostrarlo. */
  error: ServerError | null;
  /** Eventos de la última actualización (para las animaciones). */
  lastEvents: readonly GameEvent[];
  /** Sube con cada snapshot o actualización: dispara la animación de esa tanda. */
  updateSeq: number;

  create: (name: string) => Promise<Session | ServerError>;
  join: (code: string, name: string) => Promise<Session | ServerError>;
  resume: (session: Session) => Promise<boolean>;
  leave: () => Promise<void>;
  setToken: (tokenId: string) => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  setRules: (rules: RulesOverrides) => Promise<void>;
  start: () => Promise<void>;
  act: (action: Action) => Promise<boolean>;
  clearError: () => void;
}

let nextEventId = 1;
let wired = false;

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const useGame = create<GameStore>()((set, get) => {
  /** Escucha al server una sola vez (el socket es uno por pestaña). */
  const wire = () => {
    if (wired) return;
    wired = true;
    const socket = getSocket();
    socket.on('room:state', (room) => {
      set({ room });
    });
    socket.on('game:snapshot', ({ view, timers }) => {
      set((state) => ({ view, timers, lastEvents: [], updateSeq: state.updateSeq + 1 }));
    });
    socket.on('game:update', ({ view, timers, events }) => {
      const logged = events.map((event) => ({ id: nextEventId++, event }));
      set((state) => ({
        view,
        timers,
        lastEvents: events,
        updateSeq: state.updateSeq + 1,
        log: [...state.log, ...logged].slice(-LOG_LIMIT),
      }));
    });
    socket.on('disconnect', () => {
      if (get().session !== null) set({ status: 'reconnecting' });
    });
    socket.on('connect', () => {
      const { session, status } = get();
      // Al volver la conexión, reanudar con el token (SPEC.md §8).
      if (session !== null && status === 'reconnecting') void get().resume(session);
    });
  };

  const enter = async (
    event: 'room:create' | 'room:join' | 'room:resume',
    payload: object,
  ): Promise<Session | ServerError> => {
    wire();
    // Limpiar ANTES de entrar: el server manda el snapshot antes de responder
    // el ack, y limpiar después borraba la partida recién recibida.
    set({ status: 'connecting', log: [], view: null });
    const reply = (await getSocket().timeout(8000).emitWithAck(event, payload)) as Ack<{
      session: Session;
    }>;
    if (!reply.ok) {
      set({ status: 'idle' });
      return reply.error;
    }
    saveSession(reply.session);
    set({ status: 'connected', session: reply.session });
    return reply.session;
  };

  const simple = async (call: () => Promise<Ack>): Promise<void> => {
    const reply = await call();
    if (!reply.ok) set({ error: reply.error });
  };

  return {
    status: 'idle',
    session: null,
    room: null,
    view: null,
    timers: [],
    log: [],
    error: null,
    lastEvents: [],
    updateSeq: 0,

    create: (name) => enter('room:create', { name }),
    join: (code, name) => enter('room:join', { code, name }),
    resume: async (session) => {
      const result = await enter('room:resume', { code: session.code, token: session.token });
      if (typeof result === 'string') {
        forgetSession(session.code);
        set({ session: null, error: result });
        return false;
      }
      return true;
    },
    leave: async () => {
      const { session } = get();
      await getSocket().timeout(8000).emitWithAck('room:leave');
      if (session !== null) forgetSession(session.code);
      set({ session: null, room: null, view: null, log: [], status: 'idle' });
    },
    setToken: (tokenId) =>
      simple(() => getSocket().timeout(8000).emitWithAck('lobby:setToken', { tokenId })),
    setReady: (ready) =>
      simple(() => getSocket().timeout(8000).emitWithAck('lobby:setReady', { ready })),
    setRules: (rules) =>
      simple(() => getSocket().timeout(8000).emitWithAck('lobby:setRules', { rules })),
    start: () => simple(() => getSocket().timeout(8000).emitWithAck('lobby:start')),
    act: async (action) => {
      const { view } = get();
      if (view === null) return false;
      const reply = (await getSocket().timeout(8000).emitWithAck('game:intent', {
        actionId: newId(),
        expectedVersion: view.version,
        action,
      })) as Ack<{ version: number }>;
      // STALE_STATE: el estado cambió mientras se elegía; la actualización ya viene en camino.
      if (!reply.ok && reply.error !== 'STALE_STATE') set({ error: reply.error });
      return reply.ok;
    },
    clearError: () => {
      set({ error: null });
    },
  };
});
