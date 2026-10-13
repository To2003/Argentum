/**
 * Despertar al server (Render gratis se duerme a los 15 minutos sin tráfico y
 * tarda cerca de un minuto en volver).
 *
 * Si una acción no llega al server (`Unreachable`), se pasa a "despertando":
 * se espera con pausas crecientes, se consulta `/health` y, apenas responde,
 * se reintenta la acción. Pasado el tope, `WakeTimeout`. Nada de esto corre si
 * el server contesta: no hay pings periódicos.
 *
 * Pura (reloj, espera y ping inyectados) para testearla con timers simulados.
 */

/** Tope total desde que se detecta que el server no responde. */
export const WAKE_LIMIT_MS = 90_000;
/** Primera pausa; se duplica hasta `WAKE_MAX_DELAY_MS`. */
export const WAKE_FIRST_DELAY_MS = 1_000;
export const WAKE_MAX_DELAY_MS = 10_000;

/** La acción no llegó al server (sin conexión o sin respuesta a tiempo). */
export class Unreachable extends Error {
  constructor(message = 'server inalcanzable') {
    super(message);
    this.name = 'Unreachable';
  }
}

/** El server no despertó dentro del tope. */
export class WakeTimeout extends Error {
  constructor() {
    super('el server no despertó a tiempo');
    this.name = 'WakeTimeout';
  }
}

/** La pausa antes del intento `n` (0, 1, 2…): 1 s, 2 s, 4 s, 8 s, 10 s, 10 s… */
export const wakeDelay = (attempt: number): number =>
  Math.min(WAKE_FIRST_DELAY_MS * 2 ** attempt, WAKE_MAX_DELAY_MS);

export interface WakeDeps {
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
  /** ¿Respondió `/health`? Nunca rechaza: un error es `false`. */
  readonly ping: () => Promise<boolean>;
  /** Se entró en "despertando" (una sola vez por llamada). */
  readonly onWaking: (since: number) => void;
  readonly limitMs?: number;
}

export async function withWake<T>(attempt: () => Promise<T>, deps: WakeDeps): Promise<T> {
  try {
    return await attempt();
  } catch (error) {
    if (!(error instanceof Unreachable)) throw error;
  }

  const limit = deps.limitMs ?? WAKE_LIMIT_MS;
  const since = deps.now();
  deps.onWaking(since);
  for (let n = 0; ; n += 1) {
    const delay = wakeDelay(n);
    // No arrancar una espera que ya se pasa del tope.
    if (deps.now() + delay - since > limit) throw new WakeTimeout();
    await deps.sleep(delay);
    if (!(await deps.ping())) continue;
    try {
      return await attempt();
    } catch (error) {
      if (!(error instanceof Unreachable)) throw error;
    }
  }
}
