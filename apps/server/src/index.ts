import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_RULES, resolveRules, validateGameData } from '@gran-negocio/shared';
import { createGameServer } from './app.js';
import { readConfig } from './config.js';
import { sqliteStore } from './persistence.js';

// Variables de entorno documentadas en `.env.example`.
const config = readConfig(process.env);
const PORT = config.port;
const DB_PATH = config.dbPath;
/** Salas sin actividad por un día se borran. */
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 60 * 1000;

// Un board.json o cards.json roto no llega a jugarse (SPEC.md §15.2).
validateGameData();

mkdirSync(dirname(DB_PATH), { recursive: true });
const server = createGameServer({
  allowedOrigins: config.allowedOrigins,
  store: sqliteStore(DB_PATH),
  // Default de la regla por sala `useRealBrands` (SPEC.md §15.2).
  defaultRules: resolveRules({ useRealBrands: config.useRealBrands }, DEFAULT_RULES),
  // Escenarios de desarrollo (SCENARIOS): nunca en producción.
  devRoutes: config.devRoutes,
  // Pausa entre jugadas de los bots (los e2e la achican).
  botDelayMs: config.botDelayMs,
});

const restored = server.rooms.restore();
console.log(
  `${restored.restored} sala(s) restaurada(s) de ${DB_PATH}` +
    (restored.failed.length > 0 ? `; ${restored.failed.length} no se pudieron reaplicar` : ''),
);

const sweep = setInterval(() => {
  const dropped = server.rooms.sweep(ROOM_TTL_MS);
  if (dropped.length > 0) console.log(`${dropped.length} sala(s) inactiva(s) borrada(s)`);
}, SWEEP_EVERY_MS);
sweep.unref();

// Un server viejo que sigue ocupando el puerto es la versión confusa de este
// error: el navegador después ve un error de CORS de otro proceso.
server.httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`El puerto ${PORT} está ocupado: ¿quedó otro server corriendo?`);
    process.exit(1);
  }
  throw error;
});

server.httpServer.listen(PORT, () => {
  // El puerto real (con PORT=0 lo elige el sistema; lo usan los tests).
  const address = server.httpServer.address();
  const port = typeof address === 'object' && address !== null ? address.port : PORT;
  console.log(`server escuchando en http://localhost:${port}`);
  if (config.devRoutes) console.log('rutas /dev/* activas (NODE_ENV no es production)');
});

// Apagado ordenado (cada deploy en Fly.io manda SIGTERM): cerrar sockets,
// timers y la base SQLite antes de salir. Las partidas ya están guardadas
// acción por acción; esto evita cortar una escritura a la mitad.
let closing = false;
const shutdown = (signal: string) => {
  if (closing) return;
  closing = true;
  console.log(`${signal}: cerrando el server`);
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  server
    .close()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
};
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
