import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { createServer, type Server as HttpServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import {
  DEFAULT_RULES,
  PROTOCOL_VERSION,
  TILE_COUNT,
  type RulesConfig,
} from '@gran-negocio/shared';
import { registerHandlers, type IoServer } from './handlers.js';
import { memoryStore, type Store } from './persistence.js';
import { isScenario, SCENARIOS } from './dev/scenarios.js';
import { RoomManager, type Clock } from './rooms.js';

export interface ServerOptions {
  /** Orígenes del front que pueden abrir el socket. */
  readonly allowedOrigins: readonly string[];
  readonly store?: Store;
  readonly clock?: Clock;
  /** Reglas por defecto de cada sala (USE_REAL_BRANDS ya aplicado). */
  readonly defaultRules?: RulesConfig;
  /** Multiplica los segundos de las reglas: 1 en producción, chico en los tests. */
  readonly timeScale?: number;
  readonly reconnectGraceMs?: number;
  readonly autopilotDelayMs?: number;
  readonly botDelayMs?: number;
  /** Límite de mensajes por socket (por defecto, el de producción). */
  readonly rateLimit?: { readonly capacity: number; readonly perSecond: number };
  /** Rutas `/dev/*` (escenarios). Nunca en producción. */
  readonly devRoutes?: boolean;
}

export interface GameServer {
  readonly httpServer: HttpServer;
  readonly io: IoServer;
  readonly rooms: RoomManager;
  /** Cierra el socket, los timers y la base. */
  close(): Promise<void>;
}

/** Sin I, O, 0 ni 1: los códigos se dictan en voz alta (SPEC.md §8). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export const randomCode = (): string =>
  Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(
    '',
  );

/** 128 bits de `crypto` para el PRNG de la partida (ADR 0006). */
export const randomSeed = (): string => randomBytes(16).toString('hex');

/**
 * Arma Express + Socket.IO + las salas, sin escuchar en ningún puerto (los
 * tests lo levantan en un puerto libre).
 */
export function createGameServer(options: ServerOptions): GameServer {
  const { allowedOrigins } = options;
  const isAllowed = (origin: string | undefined) =>
    origin === undefined || allowedOrigins.includes(origin);
  const clock = options.clock ?? { now: () => Date.now() };
  const store = options.store ?? memoryStore();

  const rooms = new RoomManager({
    store,
    clock,
    randomSeed,
    randomCode,
    randomToken: () => randomUUID(),
    defaultRules: options.defaultRules ?? DEFAULT_RULES,
    timeScale: options.timeScale ?? 1,
    reconnectGraceMs: options.reconnectGraceMs ?? 60_000,
    autopilotDelayMs: options.autopilotDelayMs ?? 1_500,
    botDelayMs: options.botDelayMs ?? 900,
  });

  const app = express();
  app.use(
    cors({
      origin: (origin, callback) => {
        callback(null, isAllowed(origin));
      },
    }),
  );
  app.get('/health', (_req, res) => {
    res.json({ ok: true, protocol: PROTOCOL_VERSION, tiles: TILE_COUNT, rooms: rooms.size });
  });

  if (options.devRoutes === true) {
    // Crea una sala ya armada para probar un flujo (e2e o a mano).
    app.post('/dev/scenario/:name', (req, res) => {
      const { name } = req.params;
      if (!isScenario(name)) {
        res.status(404).json({ ok: false });
        return;
      }
      const { room, seats } = rooms.createScenario(SCENARIOS[name]);
      res.json({
        ok: true,
        code: room.code,
        seats: seats.map((seat) => ({
          playerId: seat.playerId,
          name: seat.name,
          token: seat.token,
        })),
      });
    });
  }

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
  registerHandlers(io, rooms, clock, options.rateLimit);

  return {
    httpServer,
    io,
    rooms,
    close: async () => {
      rooms.stop();
      await io.close();
      store.close();
    },
  };
}
