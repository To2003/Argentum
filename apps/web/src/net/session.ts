import type { Session } from '@gran-negocio/server/protocol';

/**
 * Sesiones guardadas por sala, para reconectar al recargar (SPEC.md §8). El
 * storage puede no estar (modo privado, permisos): todo va con try/catch y
 * la app funciona igual, solo que sin reconexión automática.
 */
const key = (code: string) => `gran-negocio:session:${code.toUpperCase()}`;
const NAME_KEY = 'gran-negocio:name';

export function loadSession(code: string): Session | null {
  try {
    const raw = localStorage.getItem(key(code));
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (
      typeof parsed.code !== 'string' ||
      typeof parsed.playerId !== 'string' ||
      typeof parsed.token !== 'string'
    ) {
      return null;
    }
    return { code: parsed.code, playerId: parsed.playerId, token: parsed.token };
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(key(session.code), JSON.stringify(session));
  } catch {
    // Sin storage no hay reconexión automática; la partida sigue.
  }
}

export function forgetSession(code: string): void {
  try {
    localStorage.removeItem(key(code));
  } catch {
    // Nada que borrar.
  }
}

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Solo es una comodidad.
  }
}
