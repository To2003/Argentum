import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Unreachable,
  WAKE_LIMIT_MS,
  WakeTimeout,
  wakeDelay,
  withWake,
  type WakeDeps,
} from '../src/net/wake.js';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** Dependencias con el reloj simulado de Vitest. */
function deps(ping: () => Promise<boolean>): WakeDeps & { waking: number[]; pings: number[] } {
  const waking: number[] = [];
  const pings: number[] = [];
  return {
    now: () => Date.now(),
    sleep: (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      }),
    ping: async () => {
      pings.push(Date.now());
      return ping();
    },
    onWaking: (since) => {
      waking.push(since);
    },
    waking,
    pings,
  };
}

describe('despertar al server', () => {
  it('las esperas crecen: 1, 2, 4, 8 y después 10 s', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(wakeDelay)).toEqual([
      1000, 2000, 4000, 8000, 10_000, 10_000, 10_000,
    ]);
  });

  it('si el server responde, no hay espera ni ping', async () => {
    const d = deps(() => Promise.resolve(true));
    await expect(withWake(() => Promise.resolve('sala'), d)).resolves.toBe('sala');
    expect(d.waking).toEqual([]);
    expect(d.pings).toEqual([]);
  });

  it('despierta: espera creciente, consulta /health y retoma la acción apenas responde', async () => {
    const start = Date.now();
    let awake = false;
    const d = deps(() => Promise.resolve(awake));
    const attempt = vi.fn(() =>
      awake ? Promise.resolve('sala') : Promise.reject(new Unreachable()),
    );
    const done = withWake(attempt, d);

    await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000);
    expect(d.waking).toEqual([start]);
    // Pings a 1 s, 3 s y 7 s del arranque (pausas de 1, 2 y 4 s).
    expect(d.pings.map((t) => t - start)).toEqual([1000, 3000, 7000]);
    // Mientras /health no responde, la acción no se reintenta.
    expect(attempt).toHaveBeenCalledTimes(1);

    awake = true;
    await vi.advanceTimersByTimeAsync(8000);
    await expect(done).resolves.toBe('sala');
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(d.waking).toHaveLength(1);
  });

  it('si /health responde pero la acción todavía no llega, sigue intentando', async () => {
    const d = deps(() => Promise.resolve(true));
    let calls = 0;
    const done = withWake(() => {
      calls += 1;
      return calls < 3 ? Promise.reject(new Unreachable()) : Promise.resolve('ok');
    }, d);
    await vi.advanceTimersByTimeAsync(1000 + 2000);
    await expect(done).resolves.toBe('ok');
    expect(calls).toBe(3);
  });

  it('pasado el tope (~90 s) se rinde con WakeTimeout, sin esperar de más', async () => {
    const start = Date.now();
    const d = deps(() => Promise.resolve(false));
    const done = withWake(() => Promise.reject(new Unreachable()), d);
    const settled = done.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(WAKE_LIMIT_MS + 20_000);
    expect(await settled).toBeInstanceOf(WakeTimeout);
    // Pausas 1+2+4+8+10×7 = 85 s; la siguiente (10 s) se pasaría de 90.
    expect((d.pings.at(-1) ?? 0) - start).toBe(85_000);
    expect(d.pings).toHaveLength(11);
  });

  it('un error que no es de conexión se propaga sin reintentar', async () => {
    const d = deps(() => Promise.resolve(true));
    const boom = new Error('otra cosa');
    await expect(withWake(() => Promise.reject(boom), d)).rejects.toBe(boom);
    expect(d.waking).toEqual([]);
  });
});
