import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_RULES, resolveRules, validateGameData } from '@gran-negocio/shared';
import { createGameServer } from './app.js';
import { sqliteStore } from './persistence.js';

const PORT = Number(process.env['PORT'] ?? 3001);
/** Lista separada por comas. */
const WEB_ORIGIN = process.env['WEB_ORIGIN'] ?? 'http://localhost:5173';
/** Dónde viven las partidas entre reinicios. */
const DB_PATH = process.env['DB_PATH'] ?? './data/gran-negocio.db';
/** Default de la regla por sala `useRealBrands` (SPEC.md §15.2). */
const USE_REAL_BRANDS = process.env['USE_REAL_BRANDS'] !== 'false';
/** Salas sin actividad por un día se borran. */
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 60 * 1000;

// Un board.json o cards.json roto no llega a jugarse (SPEC.md §15.2).
validateGameData();

mkdirSync(dirname(DB_PATH), { recursive: true });
const server = createGameServer({
  allowedOrigins: WEB_ORIGIN.split(',').map((origin) => origin.trim()),
  store: sqliteStore(DB_PATH),
  defaultRules: resolveRules({ useRealBrands: USE_REAL_BRANDS }, DEFAULT_RULES),
  // Escenarios de desarrollo (SCENARIOS): nunca en producción.
  devRoutes: process.env['NODE_ENV'] !== 'production',
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
  console.log(`server escuchando en http://localhost:${PORT}`);
});
