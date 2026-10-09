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
export {
  actorOf,
  actorsOf,
  isLegalAction,
  PHASE_ACTIONS,
  SYSTEM_ACTOR,
  TRADE_RESPONSES,
  validateAction,
} from './validate.js';
export { minBidFor } from './rules/auction.js';
export { netWorth } from './rules/endgame.js';
export {
  blockedByBuildings,
  buildError,
  interestOnMortgaged,
  mortgageError,
  sellError,
  unmortgageError,
} from './rules/checks.js';
export { tradeContentError } from './rules/trade.js';
export { toPlayerView, type PlayerView, type PublicPlayer } from './view.js';
export { autopilotAction, DISCONNECTED_BUY_RESERVE, type AutopilotMode } from './bots/autopilot.js';
export {
  BOT_DIFFICULTIES,
  botAction,
  newBotMemory,
  valuation,
  type BotDifficulty,
  type BotMemory,
} from './bots/bots.js';
export {
  emptyStats,
  recordStats,
  type GameStats,
  type PlayerStats,
  type WorthPoint,
} from './stats.js';
