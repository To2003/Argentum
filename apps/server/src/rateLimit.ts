/**
 * Límite de mensajes por conexión (SPEC.md §8, anti-trampa): un balde de
 * fichas. Alcanza para jugar rápido y frena a un cliente que spamea.
 */
export interface RateLimiter {
  /** true si el mensaje entra; false si hay que rechazarlo. */
  take(): boolean;
}

export function rateLimiter(
  capacity: number,
  refillPerSecond: number,
  now: () => number,
): RateLimiter {
  let tokens = capacity;
  let last = now();
  return {
    take: () => {
      const current = now();
      tokens = Math.min(capacity, tokens + ((current - last) / 1000) * refillPerSecond);
      last = current;
      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    },
  };
}
