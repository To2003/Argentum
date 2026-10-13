import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameServer, type GameServer } from '../src/app.js';
import { isInsideTemp, readConfig } from '../src/config.js';

describe('configuración por entorno', () => {
  it('valores por defecto (desarrollo)', () => {
    // Temporales explícitos: el resultado no depende de dónde esté el repo
    // (un clon en /tmp haría efímera la base por defecto, y con razón).
    expect(readConfig({}, ['/no-es-un-temporal'])).toEqual({
      port: 3001,
      allowedOrigins: ['http://localhost:5173'],
      dbPath: './data/gran-negocio.db',
      useRealBrands: true,
      devRoutes: true,
      botDelayMs: 900,
      ephemeralStorage: false,
    });
  });

  it('DB_PATH en un directorio temporal (Render gratis) se marca como efímero', () => {
    const temp = ['/tmp'];
    expect(readConfig({ DB_PATH: '/tmp/argentum.db' }, temp).ephemeralStorage).toBe(true);
    expect(readConfig({ DB_PATH: '/tmp/sub/gn.db' }, temp).ephemeralStorage).toBe(true);
    expect(readConfig({ DB_PATH: '/data/gn.db' }, temp).ephemeralStorage).toBe(false);
    // Que el nombre empiece igual no alcanza: /tmpfoo no es /tmp.
    expect(readConfig({ DB_PATH: '/tmpfoo/gn.db' }, temp).ephemeralStorage).toBe(false);
    // Una ruta relativa se resuelve contra el directorio actual.
    expect(readConfig({ DB_PATH: 'data/gn.db' }, [process.cwd()]).ephemeralStorage).toBe(true);
  });

  it('lee las variables; WEB_ORIGIN admite varios orígenes separados por comas', () => {
    const config = readConfig({
      PORT: '8080',
      WEB_ORIGIN: 'https://gran-negocio.vercel.app, https://www.example.com ,',
      DB_PATH: '/data/gn.db',
      USE_REAL_BRANDS: 'false',
      BOT_DELAY_MS: 'no-es-un-número',
    });
    expect(config).toMatchObject({
      port: 8080,
      allowedOrigins: ['https://gran-negocio.vercel.app', 'https://www.example.com'],
      dbPath: '/data/gn.db',
      useRealBrands: false,
      botDelayMs: 900,
    });
  });

  it('SEGURIDAD: con NODE_ENV=production no hay rutas /dev/*', () => {
    expect(readConfig({ NODE_ENV: 'production' }).devRoutes).toBe(false);
    expect(readConfig({ NODE_ENV: 'development' }).devRoutes).toBe(true);
  });
});

describe('SEGURIDAD: escenarios de desarrollo en producción', () => {
  let server: GameServer | null = null;
  afterEach(async () => {
    vi.unstubAllEnvs();
    await server?.close();
    server = null;
  });

  it('createGameServer no los monta en producción aunque le pidan devRoutes', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    server = createGameServer({ allowedOrigins: [], devRoutes: true });
    await new Promise<void>((resolve) => server?.httpServer.listen(0, resolve));
    const { port } = server.httpServer.address() as AddressInfo;
    const response = await fetch(`http://localhost:${port}/dev/scenario/build`, {
      method: 'POST',
    });
    expect(response.status).toBe(404);
    expect(server.rooms.size).toBe(0);
  });
});

/**
 * La prueba de punta a punta: el entry point real (`src/index.ts`, el mismo
 * que corre el contenedor) con y sin NODE_ENV=production.
 */
describe('SEGURIDAD: el proceso real del server', () => {
  const entry = fileURLToPath(new URL('../src/index.ts', import.meta.url));
  const tsx = fileURLToPath(new URL('../node_modules/.bin/tsx', import.meta.url));
  const children: ChildProcess[] = [];
  const dirs: string[] = [];
  afterEach(() => {
    for (const child of children.splice(0)) child.kill();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  /** Todo lo que imprimió el último server arrancado (stdout y stderr). */
  let lastOutput = '';

  /**
   * Arranca el server y devuelve su URL cuando ya escucha. La base va en un
   * directorio temporal (como en Render gratis) salvo que se pida otra carpeta.
   */
  async function boot(nodeEnv: string | undefined, parent = tmpdir()): Promise<string> {
    mkdirSync(parent, { recursive: true });
    const dir = mkdtempSync(join(parent, 'gn-config-'));
    dirs.push(dir);
    const env: NodeJS.ProcessEnv = { ...process.env, PORT: '0', DB_PATH: join(dir, 'gn.db') };
    delete env['NODE_ENV'];
    if (nodeEnv !== undefined) env['NODE_ENV'] = nodeEnv;
    const child = spawn(tsx, [entry], { env, shell: process.platform === 'win32' });
    children.push(child);
    lastOutput = '';
    return new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => {
        reject(new Error(`el server no arrancó:\n${output}`));
      }, 20_000);
      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
        lastOutput = output;
        const match = /escuchando en (http:\/\/localhost:\d+)/.exec(output);
        if (match?.[1] !== undefined) {
          clearTimeout(timer);
          resolve(match[1]);
        }
      });
      child.stderr.on('data', (chunk: Buffer) => {
        output += chunk.toString();
        lastOutput = output;
      });
    });
  }

  it('arranca con la base en un directorio temporal (Render gratis) y avisa que es efímera', async () => {
    const url = await boot('production');
    expect((await fetch(`${url}/health`)).status).toBe(200);
    // El aviso va por stderr: puede llegar después del "escuchando" de stdout.
    await expect.poll(() => lastOutput).toMatch(/AVISO: DB_PATH=.* está en un directorio temporal/);
    expect(lastOutput).toContain('NO sobreviven a un reinicio');
  }, 30_000);

  // Una carpeta fuera de los temporales: en el home (el repo puede estar en /tmp,
  // como el clon limpio de la verificación). Se saltea si el home es temporal.
  const disk = join(homedir(), '.cache', 'gran-negocio-test');
  it.skipIf(isInsideTemp(disk, [tmpdir(), '/tmp']))(
    'con la base fuera de los temporales (un disco), no hay aviso',
    async () => {
      await boot('production', disk);
      // Margen para que llegue stderr, si hubiera algo.
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(lastOutput).not.toContain('AVISO');
      rmSync(disk, { recursive: true, force: true });
    },
    30_000,
  );

  it('con NODE_ENV=production, /dev/scenario responde 404', async () => {
    const url = await boot('production');
    expect((await fetch(`${url}/health`)).status).toBe(200);
    for (const name of ['build', 'trade', 'auction']) {
      const response = await fetch(`${url}/dev/scenario/${name}`, { method: 'POST' });
      expect(response.status).toBe(404);
    }
  }, 30_000);

  // Fly.io manda SIGTERM en cada deploy: el server cierra la base y sale con 0.
  // (Windows no tiene señales POSIX: ahí se saltea.)
  it.skipIf(process.platform === 'win32')(
    'con SIGTERM cierra ordenado y sale con 0',
    async () => {
      await boot('production');
      const child = children.at(-1);
      if (child === undefined) throw new Error('sin proceso');
      let output = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });
      const exit = new Promise<number | null>((resolve) => {
        child.on('exit', (code) => {
          resolve(code);
        });
      });
      child.kill('SIGTERM');
      expect(await exit).toBe(0);
      expect(output).toContain('SIGTERM: cerrando el server');
    },
    30_000,
  );

  it('sin NODE_ENV (desarrollo), los escenarios existen', async () => {
    const url = await boot(undefined);
    const response = await fetch(`${url}/dev/scenario/build`, { method: 'POST' });
    expect(response.status).toBe(200);
  }, 30_000);
});
