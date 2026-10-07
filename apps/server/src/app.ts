import { createServer, type Server as HttpServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import { PROTOCOL_VERSION, TILE_COUNT } from '@gran-negocio/shared';

export interface ServerOptions {
  /** Orígenes del front que pueden abrir el socket. */
  readonly allowedOrigins: readonly string[];
}

/** Respuesta al `ping`: sirve para medir latencia y chequear el protocolo. */
export interface Pong {
  readonly pong: true;
  readonly protocol: number;
}

/** Eventos cliente → server. En M4 se suman los intents, validados con zod. */
export interface ClientToServerEvents {
  ping: (ack: (reply: Pong) => void) => void;
}

/** Los eventos server → cliente (`stateSnapshot`, `events`) se tipan en M4. */
export type IoServer = Server<ClientToServerEvents>;

export interface GameServer {
  readonly httpServer: HttpServer;
  readonly io: IoServer;
}

/**
 * Arma Express + Socket.IO sin escuchar en ningún puerto, para que los tests
 * puedan levantarlo en un puerto libre.
 *
 * M0: solo `/health` y un eco `ping` por socket. Salas, intents y reconexión
 * llegan en M4.
 */
export function createGameServer({ allowedOrigins }: ServerOptions): GameServer {
  const isAllowed = (origin: string | undefined) =>
    origin === undefined || allowedOrigins.includes(origin);

  const app = express();
  app.use(
    cors({
      origin: (origin, callback) => {
        callback(null, isAllowed(origin));
      },
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ ok: true, protocol: PROTOCOL_VERSION, tiles: TILE_COUNT });
  });

  const httpServer = createServer(app);
  const io: IoServer = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        callback(null, isAllowed(origin));
      },
    },
    // Ningún mensaje legítimo se acerca a esto.
    maxHttpBufferSize: 64 * 1024,
  });

  io.on('connection', (socket) => {
    socket.on('ping', (ack) => {
      // Un cliente puede mandar cualquier cosa: el tipo de arriba no lo garantiza.
      if (typeof ack === 'function') ack({ pong: true, protocol: PROTOCOL_VERSION });
    });
  });

  return { httpServer, io };
}
