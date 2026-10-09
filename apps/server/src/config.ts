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
}

export type Env = Readonly<Record<string, string | undefined>>;

export const isProduction = (env: Env): boolean => env['NODE_ENV'] === 'production';

const number = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return value === undefined || value === '' || !Number.isFinite(parsed) ? fallback : parsed;
};

export function readConfig(env: Env): ServerConfig {
  return {
    port: number(env['PORT'], 3001),
    allowedOrigins: (env['WEB_ORIGIN'] ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ''),
    dbPath: env['DB_PATH'] ?? './data/gran-negocio.db',
    useRealBrands: env['USE_REAL_BRANDS'] !== 'false',
    devRoutes: !isProduction(env),
    botDelayMs: number(env['BOT_DELAY_MS'], 900),
  };
}
