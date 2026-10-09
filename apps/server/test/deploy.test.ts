import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config.js';

/**
 * Los archivos de deploy (docs/deploy.md) tienen que ser coherentes entre sí y
 * con el código: un puerto, una ruta de la base o una variable que no coincide
 * solo se descubriría desplegando, que acá no se puede.
 */
const root = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const read = (path: string) => readFileSync(root(path), 'utf8');

/** Las `KEY = "value"` de una sección de un TOML simple (sin tablas anidadas raras). */
function tomlSection(toml: string, section: string): Record<string, string> {
  const lines = toml.split('\n');
  const start = lines.findIndex((line) => line.trim() === `[${section}]`);
  if (start < 0) throw new Error(`fly.toml sin [${section}]`);
  const values: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) break;
    const match = /^(\w+)\s*=\s*"?([^"#]*?)"?\s*(#.*)?$/.exec(trimmed);
    if (match?.[1] !== undefined && match[2] !== undefined) values[match[1]] = match[2].trim();
  }
  return values;
}

const versionAtLeast = (version: string, minimum: readonly number[]) => {
  const parts = version.split('.').map(Number);
  for (let i = 0; i < minimum.length; i += 1) {
    const have = parts[i] ?? 0;
    const want = minimum[i] ?? 0;
    if (have !== want) return have > want;
  }
  return true;
};

/** `node:sqlite` sin flag: desde 22.13.0 (y 23.4.0). */
const SQLITE_MIN = [22, 13, 0];

describe('deploy: fly.toml', () => {
  const toml = read('fly.toml');
  const env = tomlSection(toml, 'env');
  const http = tomlSection(toml, 'http_service');
  const mounts = tomlSection(toml, 'mounts');

  it('producción: NODE_ENV=production, así no hay rutas /dev/*', () => {
    expect(env['NODE_ENV']).toBe('production');
    expect(readConfig(env).devRoutes).toBe(false);
  });

  it('el server escucha en el puerto que Fly le manda', () => {
    expect(http['internal_port']).toBe(env['PORT']);
  });

  it('la base SQLite queda dentro del volumen montado', () => {
    expect(mounts['destination']).toBe('/data');
    expect(env['DB_PATH']?.startsWith(`${mounts['destination'] ?? '?'}/`)).toBe(true);
  });

  it('una sola máquina, siempre prendida (las salas viven en memoria)', () => {
    expect(http['auto_stop_machines']).toBe('off');
    expect(http['min_machines_running']).toBe('1');
  });

  it('el health check pega en /health y WEB_ORIGIN es una URL https sin barra final', () => {
    expect(toml).toMatch(/\[\[http_service\.checks\]\][^[]*path = "\/health"/);
    const origins = readConfig(env).allowedOrigins;
    expect(origins.length).toBeGreaterThan(0);
    for (const origin of origins) expect(origin).toMatch(/^https:\/\/[^/]+$/);
  });

  it('el build usa el Dockerfile del server con la raíz del repo como contexto', () => {
    expect(tomlSection(toml, 'build')['dockerfile']).toBe('apps/server/Dockerfile');
  });
});

describe('deploy: Dockerfile y versión de Node', () => {
  const dockerfile = read('apps/server/Dockerfile');

  it('Node con node:sqlite sin flag, y NODE_ENV=production en la imagen final', () => {
    const version = /ARG NODE_VERSION=(\d+\.\d+\.\d+)/.exec(dockerfile)?.[1];
    expect(version).toBeDefined();
    expect(versionAtLeast(version ?? '0', SQLITE_MIN)).toBe(true);
    const runStage = dockerfile.slice(dockerfile.lastIndexOf('FROM '));
    expect(runStage).toContain('ENV NODE_ENV=production');
    expect(runStage).toMatch(/ENV DB_PATH=\/data\//);
    expect(runStage).toContain('/health');
  });

  it('engines de package.json no promete una versión sin node:sqlite', () => {
    const pkg = JSON.parse(read('package.json')) as { engines: { node: string } };
    const minimum = /(\d+\.\d+(?:\.\d+)?)/.exec(pkg.engines.node)?.[1] ?? '0';
    expect(versionAtLeast(minimum, SQLITE_MIN)).toBe(true);
  });

  it('el .dockerignore no deja afuera los datos del juego (packages/shared/data)', () => {
    const ignored = read('.dockerignore')
      .split('\n')
      .map((line) => line.trim());
    expect(ignored).not.toContain('data');
    expect(ignored).not.toContain('**/data');
  });
});

describe('deploy: Vercel', () => {
  const vercel = JSON.parse(read('apps/web/vercel.json')) as {
    outputDirectory: string;
    rewrites: { source: string; destination: string }[];
  };

  it('las rutas de la SPA (/sala/:codigo) caen en index.html', () => {
    expect(vercel.rewrites).toContainEqual({ source: '/sala/:codigo', destination: '/index.html' });
    expect(vercel.rewrites.at(-1)).toEqual({ source: '/(.*)', destination: '/index.html' });
    expect(vercel.outputDirectory).toBe('dist');
  });
});

describe('deploy: .env.example documenta todas las variables', () => {
  const example = read('.env.example');
  const used = new Set<string>();
  for (const file of ['apps/server/src/config.ts', 'apps/web/src/net/client.ts']) {
    for (const match of read(file).matchAll(/env\['([A-Z_]+)'\]/g)) {
      if (match[1] !== undefined) used.add(match[1]);
    }
  }

  it('cada variable que lee el código aparece en .env.example', () => {
    expect([...used].sort()).toEqual([
      'BOT_DELAY_MS',
      'DB_PATH',
      'NODE_ENV',
      'PORT',
      'USE_REAL_BRANDS',
      'VITE_SERVER_URL',
      'WEB_ORIGIN',
    ]);
    for (const name of used) expect(example).toMatch(new RegExp(`^#? ?${name}=`, 'm'));
  });
});
