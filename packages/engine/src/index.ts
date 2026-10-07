/**
 * Motor de reglas puro (SPEC.md §3.1): sin DOM, sin red, sin reloj y sin
 * azar ambiente. Todo el azar sale del PRNG de `rng.ts`, cuyo estado vive en
 * el GameState, así que `seed + acciones[]` reconstruye la partida exacta.
 */
export * from './rng.js';
