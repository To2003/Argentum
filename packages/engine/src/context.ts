import type { GameEvent } from './events.js';
import type { Debt, GameState, OwnedProperty, PlayerId, PlayerState, TileIndex } from './types.js';

/**
 * Lo que comparten las reglas mientras se aplica una acción: el borrador del
 * estado (un clon, se puede mutar), los eventos en orden y lo que quedó
 * pendiente al terminar de resolver la casilla.
 */
export interface Ctx {
  readonly s: GameState;
  readonly events: GameEvent[];
  /** Deudas abiertas en esta acción; el reducer las convierte en la fase inDebt. */
  readonly debts: Debt[];
  /** Propiedad sin dueño en la que cayó; el reducer la convierte en awaitingPurchase. */
  pendingPurchase: TileIndex | null;
}

export const createCtx = (s: GameState): Ctx => ({
  s,
  events: [],
  debts: [],
  pendingPurchase: null,
});

/** Un jugador que tiene que existir: si no, es un bug del engine, no una jugada inválida. */
export function playerOf(s: GameState, id: PlayerId): PlayerState {
  const player = s.players[id];
  if (player === undefined) throw new Error(`no existe el jugador ${id}`);
  return player;
}

export const activePlayers = (s: GameState): PlayerId[] =>
  s.turnOrder.filter((id) => !playerOf(s, id).bankrupt);

/**
 * Los demás jugadores activos, empezando por el siguiente a `id` en el orden
 * de turno. Es el orden determinista de cobros y deudas múltiples
 * (cumpleaños, presidente del consorcio).
 */
export function othersInTurnOrder(s: GameState, id: PlayerId): PlayerId[] {
  const start = s.turnOrder.indexOf(id);
  const rotated = [...s.turnOrder.slice(start + 1), ...s.turnOrder.slice(0, start)];
  return rotated.filter((other) => !playerOf(s, other).bankrupt);
}

/** La entrada de una casilla con dueño; si no tiene, es un bug del engine. */
export function ownedAt(s: GameState, tile: TileIndex): OwnedProperty {
  const owned = s.properties[tile];
  if (owned === undefined) throw new Error(`la casilla ${tile} no tiene dueño`);
  return owned;
}

/** Copia profunda de un estado: es JSON puro (sin funciones, fechas ni Map). */
export const cloneState = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
