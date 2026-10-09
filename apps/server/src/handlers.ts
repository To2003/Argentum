import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import { PROTOCOL_VERSION } from '@gran-negocio/shared';
import type {
  Ack,
  ClientToServerEvents,
  ServerError,
  ServerToClientEvents,
  Session,
} from './protocol.js';
import { rateLimiter } from './rateLimit.js';
import type { Clock, Room, RoomManager } from './rooms.js';
import {
  AddBotSchema,
  ChatSchema,
  CreateRoomSchema,
  RemoveBotSchema,
  IntentSchema,
  JoinRoomSchema,
  ResumeSchema,
  SetReadySchema,
  SetRulesSchema,
  SetTokenSchema,
  WatchSchema,
} from './schema.js';

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** Lo que un socket sabe de sí mismo después de entrar a una sala. */
interface SocketData {
  code: string | null;
  playerId: string | null;
  /** Sala que mira como espectador (sin asiento), si mira una. */
  watching: string | null;
}

/** Mensajes por socket: 30 de golpe y 10 por segundo sostenidos (SPEC.md §8). */
export const DEFAULT_RATE_LIMIT = { capacity: 30, perSecond: 10 } as const;

type Failure = Extract<Ack, { ok: false }>;
type Reply = ({ readonly ok: true } & Record<string, unknown>) | Failure;

/** Responde el ack si el cliente mandó uno (un cliente malicioso puede no mandarlo). */
const reply = (ack: unknown, value: Reply): void => {
  if (typeof ack === 'function') (ack as (value: Reply) => void)(value);
};

const failure = (error: ServerError): Failure => ({ ok: false, error });

/**
 * Conecta los sockets con las salas. Cada mensaje entrante pasa por el rate
 * limit y por zod antes de tocar nada.
 */
export function registerHandlers(
  io: IoServer,
  rooms: RoomManager,
  clock: Clock,
  rate: { readonly capacity: number; readonly perSecond: number } = DEFAULT_RATE_LIMIT,
): void {
  /** Los sockets de cada asiento: `${code}:${playerId}` (un jugador puede tener varias pestañas). */
  const sockets = new Map<string, Set<GameSocket>>();
  const keyOf = (code: string, playerId: string) => `${code}:${playerId}`;
  /** Los espectadores de cada sala (M9): reciben la vista sin viewer. */
  const watchers = new Map<string, Set<GameSocket>>();

  /** Las estadísticas viajan solo al final: durante la partida no hacen falta. */
  const statsOf = (room: Room) => (room.state?.phase.kind === 'gameOver' ? room.stats : null);

  const sendSnapshot = (socket: GameSocket, room: Room, playerId: string | null) => {
    const view = rooms.view(room, playerId);
    if (view === null) return;
    socket.emit('game:snapshot', {
      seq: room.log.length,
      view,
      timers: rooms.timersOf(room),
      stats: statsOf(room),
    });
  };

  rooms.onChange(({ room, events, game }) => {
    io.to(room.code).emit('room:state', rooms.publicState(room));
    if (!game) return;
    const timers = rooms.timersOf(room);
    const stats = statsOf(room);
    const seq = room.log.length;
    for (const seat of room.seats) {
      const view = rooms.view(room, seat.playerId);
      if (view === null) continue;
      for (const socket of sockets.get(keyOf(room.code, seat.playerId)) ?? []) {
        socket.emit('game:update', { seq, view, events, timers, stats });
      }
    }
    const watching = watchers.get(room.code);
    const view = rooms.view(room, null);
    if (watching === undefined || view === null) return;
    for (const socket of watching) socket.emit('game:update', { seq, view, events, timers, stats });
  });

  io.on('connection', (socket: GameSocket) => {
    const data: SocketData = { code: null, playerId: null, watching: null };
    const limiter = rateLimiter(rate.capacity, rate.perSecond, () => clock.now());

    const attach = (room: Room, playerId: string) => {
      detach();
      data.code = room.code;
      data.playerId = playerId;
      const key = keyOf(room.code, playerId);
      const set = sockets.get(key) ?? new Set<GameSocket>();
      set.add(socket);
      sockets.set(key, set);
      void socket.join(room.code);
      rooms.setConnected(room, playerId, true);
      socket.emit('room:state', rooms.publicState(room));
      sendSnapshot(socket, room, playerId);
      socket.emit('chat:history', room.chat);
    };

    const unwatch = () => {
      if (data.watching === null) return;
      watchers.get(data.watching)?.delete(socket);
      if (watchers.get(data.watching)?.size === 0) watchers.delete(data.watching);
      void socket.leave(data.watching);
      data.watching = null;
    };

    const detach = () => {
      unwatch();
      if (data.code === null || data.playerId === null) return;
      const key = keyOf(data.code, data.playerId);
      const set = sockets.get(key);
      set?.delete(socket);
      void socket.leave(data.code);
      const room = rooms.get(data.code);
      // Solo queda desconectado si no le queda ninguna pestaña abierta.
      if (room !== undefined && (set === undefined || set.size === 0)) {
        sockets.delete(key);
        rooms.setConnected(room, data.playerId, false);
      }
      data.code = null;
      data.playerId = null;
    };

    /** Rate limit + zod + sesión. Devuelve el payload validado o responde el error. */
    function guard<T extends z.ZodType>(
      schema: T,
      payload: unknown,
      ack: unknown,
    ): z.infer<T> | null {
      if (!limiter.take()) {
        reply(ack, failure('RATE_LIMITED'));
        return null;
      }
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        reply(ack, failure('BAD_PAYLOAD'));
        return null;
      }
      return parsed.data;
    }

    const current = (ack: unknown): { room: Room; playerId: string } | null => {
      const room = data.code === null ? undefined : rooms.get(data.code);
      if (room === undefined || data.playerId === null) {
        reply(ack, failure('NO_SESSION'));
        return null;
      }
      return { room, playerId: data.playerId };
    };

    const session = (room: Room, playerId: string): Session => {
      const seat = room.seats.find((candidate) => candidate.playerId === playerId);
      return { code: room.code, playerId, token: seat?.token ?? '' };
    };

    socket.on('ping', (ack) => {
      if (typeof ack === 'function') ack({ pong: true, protocol: PROTOCOL_VERSION });
    });

    socket.on('room:create', (payload, ack) => {
      const input = guard(CreateRoomSchema, payload, ack);
      if (input === null) return;
      const { room, seat } = rooms.create(input.name);
      attach(room, seat.playerId);
      reply(ack, { ok: true, session: session(room, seat.playerId) });
    });

    socket.on('room:join', (payload, ack) => {
      const input = guard(JoinRoomSchema, payload, ack);
      if (input === null) return;
      const result = rooms.join(input.code, input.name);
      if (!result.ok) {
        reply(ack, failure(result.error));
        return;
      }
      attach(result.value.room, result.value.seat.playerId);
      reply(ack, { ok: true, session: session(result.value.room, result.value.seat.playerId) });
    });

    socket.on('room:resume', (payload, ack) => {
      const input = guard(ResumeSchema, payload, ack);
      if (input === null) return;
      const result = rooms.resume(input.code, input.token);
      if (!result.ok) {
        reply(ack, failure(result.error));
        return;
      }
      attach(result.value.room, result.value.seat.playerId);
      reply(ack, { ok: true, session: session(result.value.room, result.value.seat.playerId) });
    });

    socket.on('room:leave', (ack) => {
      if (!limiter.take()) {
        reply(ack, failure('RATE_LIMITED'));
        return;
      }
      const me = current(ack);
      if (me === null) return;
      detach();
      rooms.leave(me.room, me.playerId);
      reply(ack, { ok: true });
    });

    socket.on('room:watch', (payload, ack) => {
      const input = guard(WatchSchema, payload, ack);
      if (input === null) return;
      const room = rooms.get(input.code);
      if (room === undefined) {
        reply(ack, failure('ROOM_NOT_FOUND'));
        return;
      }
      // En el lobby no hay nada que mirar: se entra con un asiento.
      if (room.status === 'lobby') {
        reply(ack, failure('GAME_NOT_STARTED'));
        return;
      }
      detach();
      data.watching = room.code;
      const set = watchers.get(room.code) ?? new Set<GameSocket>();
      set.add(socket);
      watchers.set(room.code, set);
      void socket.join(room.code);
      socket.emit('room:state', rooms.publicState(room));
      sendSnapshot(socket, room, null);
      socket.emit('chat:history', room.chat);
      reply(ack, { ok: true });
    });

    socket.on('room:rematch', (ack) => {
      if (!limiter.take()) {
        reply(ack, failure('RATE_LIMITED'));
        return;
      }
      const me = current(ack);
      if (me === null) return;
      const result = rooms.rematch(me.room, me.playerId);
      reply(ack, result.ok ? { ok: true } : failure(result.error));
    });

    socket.on('chat:send', (payload, ack) => {
      const input = guard(ChatSchema, payload, ack);
      const me = input === null ? null : current(ack);
      if (input === null || me === null) return;
      const result = rooms.chat(me.room, me.playerId, input);
      if (!result.ok) {
        reply(ack, failure(result.error));
        return;
      }
      io.to(me.room.code).emit('chat:message', result.value);
      reply(ack, { ok: true });
    });

    socket.on('lobby:setToken', (payload, ack) => {
      const input = guard(SetTokenSchema, payload, ack);
      const me = input === null ? null : current(ack);
      if (input === null || me === null) return;
      const result = rooms.setToken(me.room, me.playerId, input.tokenId);
      reply(ack, result.ok ? { ok: true } : failure(result.error));
    });

    socket.on('lobby:setReady', (payload, ack) => {
      const input = guard(SetReadySchema, payload, ack);
      const me = input === null ? null : current(ack);
      if (input === null || me === null) return;
      const result = rooms.setReady(me.room, me.playerId, input.ready);
      reply(ack, result.ok ? { ok: true } : failure(result.error));
    });

    socket.on('lobby:setRules', (payload, ack) => {
      const input = guard(SetRulesSchema, payload, ack);
      const me = input === null ? null : current(ack);
      if (input === null || me === null) return;
      const result = rooms.setRules(me.room, me.playerId, input.rules);
      reply(ack, result.ok ? { ok: true } : failure(result.error));
    });

    socket.on('lobby:addBot', (payload, ack) => {
      const input = guard(AddBotSchema, payload, ack);
      const me = input === null ? null : current(ack);
      if (input === null || me === null) return;
      const result = rooms.addBot(me.room, me.playerId, input.difficulty);
      reply(ack, result.ok ? { ok: true } : failure(result.error));
    });

    socket.on('lobby:removeBot', (payload, ack) => {
      const input = guard(RemoveBotSchema, payload, ack);
      const me = input === null ? null : current(ack);
      if (input === null || me === null) return;
      const result = rooms.removeBot(me.room, me.playerId, input.playerId);
      reply(ack, result.ok ? { ok: true } : failure(result.error));
    });

    socket.on('lobby:start', (ack) => {
      if (!limiter.take()) {
        reply(ack, failure('RATE_LIMITED'));
        return;
      }
      const me = current(ack);
      if (me === null) return;
      const result = rooms.start(me.room, me.playerId);
      reply(ack, result.ok ? { ok: true } : failure(result.error));
    });

    socket.on('game:intent', (payload, ack) => {
      const input = guard(IntentSchema, payload, ack);
      const me = input === null ? null : current(ack);
      if (input === null || me === null) return;
      const result = rooms.intent(me.room, me.playerId, input);
      reply(ack, result.ok ? { ok: true, version: result.value.version } : failure(result.error));
    });

    socket.on('disconnect', () => {
      detach();
    });
  });
}
