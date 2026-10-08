import type { ClientToServerEvents, ServerToClientEvents } from '@gran-negocio/server/protocol';
import { io, type Socket } from 'socket.io-client';

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
