import type {
  BotDifficulty,
  ErrorCode,
  GameEvent,
  GameStats,
  PlayerId,
  PlayerView,
} from '@gran-negocio/engine';
import type { EmoteId, RulesConfig } from '@gran-negocio/shared';

/**
 * El protocolo cliente ↔ server (SPEC.md §8, ADR 0002).
 *
 * Cliente → server: todo con ack. Server → cliente: el estado de la sala, el
 * snapshot de la partida al entrar o reconectar y actualizaciones con número
 * de secuencia después de cada acción.
 */

/** Errores de transporte y de sala: otra capa que los ErrorCode del engine. */
export type TransportError =
  | 'BAD_PAYLOAD'
  | 'RATE_LIMITED'
  | 'NO_SESSION'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'NOT_HOST'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NOT_READY'
  | 'TOKEN_TAKEN'
  | 'GAME_IN_PROGRESS'
  | 'GAME_NOT_STARTED'
  | 'BAD_TOKEN'
  | 'BAD_RULES'
  | 'STALE_STATE';

/** Todo error que puede volver en un ack: del engine o de transporte. */
export type ServerError = ErrorCode | TransportError;

/** La respuesta de un mensaje: `ok` con datos (si `T` no es null) o el error. */
export type Ack<T extends object | null = null> =
  | (T extends object ? { readonly ok: true } & T : { readonly ok: true })
  | { readonly ok: false; readonly error: ServerError };

/** Un asiento como lo ve cualquiera en la sala. Nunca lleva el token secreto. */
export interface PublicSeat {
  readonly playerId: PlayerId;
  readonly name: string;
  readonly tokenId: string | null;
  readonly ready: boolean;
  readonly connected: boolean;
  readonly isBot: boolean;
  readonly bot: BotDifficulty | null;
}

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface RoomState {
  readonly code: string;
  readonly hostId: PlayerId;
  readonly status: RoomStatus;
  readonly seats: readonly PublicSeat[];
  readonly rules: RulesConfig;
}

/** A qué se está esperando y hasta cuándo (para la cuenta regresiva de la UI). */
export interface TimerState {
  readonly kind: 'turn' | 'auction' | 'trade' | 'game';
  /** Epoch ms. */
  readonly deadline: number;
  readonly playerIds: readonly PlayerId[];
}

export interface GameSnapshot {
  /** Cantidad de acciones aplicadas: el número de secuencia del estado. */
  readonly seq: number;
  readonly view: PlayerView;
  readonly timers: readonly TimerState[];
  /** Estadísticas (M9): solo cuando la partida terminó. */
  readonly stats: GameStats | null;
}

export interface GameUpdate extends GameSnapshot {
  readonly events: readonly GameEvent[];
}

/** La sesión que el cliente guarda para reconectar. */
export interface Session {
  readonly code: string;
  readonly playerId: PlayerId;
  readonly token: string;
}

/** Un mensaje del chat (M9): texto libre o una reacción rápida, nunca las dos. */
export interface ChatMessage {
  readonly id: number;
  readonly playerId: PlayerId;
  readonly name: string;
  /** Epoch ms. */
  readonly at: number;
  readonly text: string | null;
  readonly emote: EmoteId | null;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'game:snapshot': (snapshot: GameSnapshot) => void;
  'game:update': (update: GameUpdate) => void;
  /** Al entrar: los últimos mensajes. */
  'chat:history': (messages: readonly ChatMessage[]) => void;
  'chat:message': (message: ChatMessage) => void;
}

export interface ClientToServerEvents {
  ping: (ack: (reply: { pong: true; protocol: number }) => void) => void;
  'room:create': (payload: unknown, ack: (reply: Ack<{ session: Session }>) => void) => void;
  'room:join': (payload: unknown, ack: (reply: Ack<{ session: Session }>) => void) => void;
  'room:resume': (payload: unknown, ack: (reply: Ack<{ session: Session }>) => void) => void;
  'room:leave': (ack: (reply: Ack) => void) => void;
  /** Mirar una partida en curso sin asiento (M9). */
  'room:watch': (payload: unknown, ack: (reply: Ack) => void) => void;
  /** El host vuelve la sala al lobby después de terminar (M9). */
  'room:rematch': (ack: (reply: Ack) => void) => void;
  'chat:send': (payload: unknown, ack: (reply: Ack) => void) => void;
  'lobby:setToken': (payload: unknown, ack: (reply: Ack) => void) => void;
  'lobby:setReady': (payload: unknown, ack: (reply: Ack) => void) => void;
  'lobby:setRules': (payload: unknown, ack: (reply: Ack) => void) => void;
  'lobby:start': (ack: (reply: Ack) => void) => void;
  'lobby:addBot': (payload: unknown, ack: (reply: Ack) => void) => void;
  'lobby:removeBot': (payload: unknown, ack: (reply: Ack) => void) => void;
  'game:intent': (payload: unknown, ack: (reply: Ack<{ version: number }>) => void) => void;
}
