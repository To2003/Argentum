import type { ClientToServerEvents, ServerToClientEvents } from '@gran-negocio/server/protocol';
import { io, type Socket } from 'socket.io-client';
import { Unreachable } from './wake.js';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Dónde está el server de juego (VITE_SERVER_URL, o el mismo host en el puerto 3001). */
export function serverUrl(): string {
  const configured = import.meta.env['VITE_SERVER_URL'] as string | undefined;
  if (configured !== undefined && configured !== '') return configured;
  return `${window.location.protocol}//${window.location.hostname}:3001`;
}

let socket: GameSocket | null = null;

/** Un solo socket por pestaña; se crea la primera vez que se pide. */
export function getSocket(): GameSocket {
  socket ??= io(serverUrl(), { transports: ['websocket'], autoConnect: true });
  return socket;
}

/** Cuánto se espera la conexión o la respuesta antes de dar al server por dormido. */
export const REQUEST_TIMEOUT_MS = 8_000;

/** Resuelve cuando el socket está conectado; si no conecta a tiempo, `Unreachable`. */
function connected(socket: GameSocket, timeoutMs: number): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('connect', onConnect);
      reject(new Unreachable('sin conexión'));
    }, timeoutMs);
    const onConnect = () => {
      clearTimeout(timer);
      resolve();
    };
    socket.once('connect', onConnect);
  });
}

/**
 * Un pedido con respuesta que **solo se emite con el socket conectado**: si no,
 * Socket.IO lo guardaría y lo mandaría al reconectar, y el reintento lo
 * duplicaría (dos asientos para la misma persona). Sin conexión o sin
 * respuesta a tiempo → `Unreachable`.
 */
export type EnterEvent = 'room:create' | 'room:join' | 'room:resume' | 'room:watch';

export async function request<T>(event: EnterEvent, payload: object): Promise<T> {
  const socket = getSocket();
  await connected(socket, REQUEST_TIMEOUT_MS);
  try {
    return (await socket.timeout(REQUEST_TIMEOUT_MS).emitWithAck(event, payload)) as T;
  } catch {
    throw new Unreachable('sin respuesta');
  }
}

/** ¿Responde `/health`? Solo se consulta mientras se espera que el server despierte. */
export async function pingHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${serverUrl()}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
