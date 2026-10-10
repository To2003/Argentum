import { tmpdir } from 'node:os';
import { relative, resolve, isAbsolute } from 'node:path';

/**
 * La configuración del server a partir de las variables de entorno. Es una
 * función pura para poder testear cada decisión (sobre todo la de seguridad:
 * los escenarios de desarrollo nunca en producción).
 *
 * Todas las variables están documentadas en `.env.example`.
 */
export interface ServerConfig {
  readonly port: number;
  /** Orígenes del front que pueden abrir el socket (CORS). */
  readonly allowedOrigins: readonly string[];
  readonly dbPath: string;
  readonly useRealBrands: boolean;
  /** Rutas `/dev/*` (escenarios armados): solo fuera de producción. */
  readonly devRoutes: boolean;
  readonly botDelayMs: number;
  /**
   * La base está en un directorio temporal (p. ej. `/tmp` en el plan gratis de
   * Render, sin disco persistente): las salas no sobreviven a un reinicio.
   */
  readonly ephemeralStorage: boolean;
}

export type Env = Readonly<Record<string, string | undefined>>;

export const isProduction = (env: Env): boolean => env['NODE_ENV'] === 'production';

const number = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return value === undefined || value === '' || !Number.isFinite(parsed) ? fallback : parsed;
};

/** true si `path` está dentro de alguno de los directorios temporales. */
export function isInsideTemp(path: string, tempDirs: readonly string[]): boolean {
  const target = resolve(path);
  return tempDirs.some((dir) => {
    const inside = relative(resolve(dir), target);
    return inside !== '' && !inside.startsWith('..') && !isAbsolute(inside);
  });
}

/** `/tmp` aunque el sistema diga otra cosa: es donde lo pone un render.yaml. */
const TEMP_DIRS = [tmpdir(), '/tmp'];

export function readConfig(env: Env, tempDirs: readonly string[] = TEMP_DIRS): ServerConfig {
  const dbPath = env['DB_PATH'] ?? './data/gran-negocio.db';
  return {
    port: number(env['PORT'], 3001),
    allowedOrigins: (env['WEB_ORIGIN'] ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ''),
    dbPath,
    useRealBrands: env['USE_REAL_BRANDS'] !== 'false',
    devRoutes: !isProduction(env),
    botDelayMs: number(env['BOT_DELAY_MS'], 900),
    ephemeralStorage: isInsideTemp(dbPath, tempDirs),
  };
}
