/**
 * Motor de reglas puro (SPEC.md §3.1): sin DOM, sin red, sin reloj y sin
 * azar ambiente. Todo el azar sale del PRNG de `rng.ts`, cuyo estado vive en
 * el GameState, así que `seed + acciones[]` reconstruye la partida exacta.
 */
export { createGame, RESERVED_PLAYER_IDS, type GameSetup } from './createGame.js';
export type { GameEvent, GameEventType } from './events.js';
export { CANDIDATE_ACTIONS, legalActions } from './legal.js';
export { applyAction, type ApplyResult } from './reducer.js';
export * from './rng.js';
export { MAX_RESOLUTION_DEPTH } from './rules/tiles.js';
export { mortgageInterest, mortgageLiftCost } from './rules/mortgage.js';
export { rentFor, ownsWholeGroup, type NearestModifier } from './rules/rent.js';
export type * from './types.js';
export { actorOf, isLegalAction, PHASE_ACTIONS, validateAction } from './validate.js';
export { toPlayerView, type PlayerView, type PublicPlayer } from './view.js';
