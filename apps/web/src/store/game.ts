import type { Action, BotDifficulty, GameEvent, GameStats, PlayerView } from '@gran-negocio/engine';
import type {
  Ack,
  ChatMessage,
  RoomState,
  ServerError,
  Session,
  TimerState,
} from '@gran-negocio/server/protocol';
import { CHAT_HISTORY, type EmoteId, type RulesOverrides } from '@gran-negocio/shared';
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
  /** Sala que se mira como espectador (M9), sin asiento. */
  watching: string | null;
  chat: readonly ChatMessage[];
  /** Estadísticas de fin de partida (M9); null mientras se juega. */
  stats: GameStats | null;
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
  watch: (code: string) => Promise<ServerError | null>;
  rematch: () => Promise<void>;
  sendChat: (message: { text: string } | { emote: EmoteId }) => Promise<void>;
  resume: (session: Session) => Promise<boolean>;
  leave: () => Promise<void>;
  setToken: (tokenId: string) => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  setRules: (rules: RulesOverrides) => Promise<void>;
  start: () => Promise<void>;
  addBot: (difficulty: BotDifficulty) => Promise<void>;
  removeBot: (playerId: string) => Promise<void>;
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
      // Revancha (M9): la sala volvió al lobby; la partida anterior se descarta.
      // Un espectador no tiene asiento en el lobby: deja de mirar.
      if (room.status === 'lobby' && get().view !== null) {
        set({ view: null, log: [], stats: null, lastEvents: [] });
      }
      if (room.status === 'lobby' && get().watching !== null) {
        set({ watching: null, room: null, status: 'idle' });
        return;
      }
      set({ room });
    });
    socket.on('game:snapshot', ({ view, timers, stats }) => {
      set((state) => ({ view, timers, stats, lastEvents: [], updateSeq: state.updateSeq + 1 }));
    });
    socket.on('game:update', ({ view, timers, events, stats }) => {
      const logged = events.map((event) => ({ id: nextEventId++, event }));
      set((state) => ({
        view,
        timers,
        stats,
        lastEvents: events,
        updateSeq: state.updateSeq + 1,
        log: [...state.log, ...logged].slice(-LOG_LIMIT),
      }));
    });
    socket.on('chat:history', (chat) => {
      set({ chat });
    });
    socket.on('chat:message', (message) => {
      set((state) => ({ chat: [...state.chat, message].slice(-CHAT_HISTORY) }));
    });
    socket.on('disconnect', () => {
      if (get().session !== null || get().watching !== null) set({ status: 'reconnecting' });
    });
    socket.on('connect', () => {
      const { session, watching, status } = get();
      if (status !== 'reconnecting') return;
      // Al volver la conexión, reanudar con el token (SPEC.md §8) o volver a mirar.
      if (session !== null) void get().resume(session);
      else if (watching !== null) void get().watch(watching);
    });
  };

  const enter = async (
    event: 'room:create' | 'room:join' | 'room:resume',
    payload: object,
  ): Promise<Session | ServerError> => {
    wire();
    // Limpiar ANTES de entrar: el server manda el snapshot antes de responder
    // el ack, y limpiar después borraba la partida recién recibida.
    set({ status: 'connecting', log: [], view: null, chat: [], stats: null, watching: null });
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
    watching: null,
    chat: [],
    stats: null,
    room: null,
    view: null,
    timers: [],
    log: [],
    error: null,
    lastEvents: [],
    updateSeq: 0,

    create: (name) => enter('room:create', { name }),
    join: (code, name) => enter('room:join', { code, name }),
    watch: async (code) => {
      wire();
      set({ status: 'connecting', log: [], view: null, chat: [], stats: null, session: null });
      const reply = (await getSocket().timeout(8000).emitWithAck('room:watch', { code })) as Ack;
      if (!reply.ok) {
        set({ status: 'idle', watching: null });
        return reply.error;
      }
      set({ status: 'connected', watching: code });
      return null;
    },
    rematch: () => simple(() => getSocket().timeout(8000).emitWithAck('room:rematch')),
    sendChat: (message) =>
      simple(() => getSocket().timeout(8000).emitWithAck('chat:send', message)),
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
      set({ session: null, room: null, view: null, log: [], chat: [], status: 'idle' });
    },
    setToken: (tokenId) =>
      simple(() => getSocket().timeout(8000).emitWithAck('lobby:setToken', { tokenId })),
    setReady: (ready) =>
      simple(() => getSocket().timeout(8000).emitWithAck('lobby:setReady', { ready })),
    setRules: (rules) =>
      simple(() => getSocket().timeout(8000).emitWithAck('lobby:setRules', { rules })),
    start: () => simple(() => getSocket().timeout(8000).emitWithAck('lobby:start')),
    addBot: (difficulty) =>
      simple(() => getSocket().timeout(8000).emitWithAck('lobby:addBot', { difficulty })),
    removeBot: (playerId) =>
      simple(() => getSocket().timeout(8000).emitWithAck('lobby:removeBot', { playerId })),
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
