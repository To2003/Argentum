import type { GameEvent } from './events.js';
import { netWorth } from './rules/endgame.js';
import type { DeepReadonly, GameState, PlayerId } from './types.js';

/**
 * Estadísticas de fin de partida (SPEC.md §5.8, M9). Salen solo de los
 * eventos y del estado después de cada acción, así que dos replays de la
 * misma partida dan las mismas estadísticas.
 */
export interface PlayerStats {
  /** Todo lo que le entró: salario, alquileres, cartas, ventas, trueques en efectivo. */
  readonly collected: number;
  /** Todo lo que le salió: compras, alquileres, impuestos, multas, construcción. */
  readonly paid: number;
  readonly rentCollected: number;
  readonly rentPaid: number;
  /** Veces que fue preso. */
  readonly jailVisits: number;
}

export interface WorthPoint {
  readonly round: number;
  /** Patrimonio de cada jugador (0 si quebró). */
  readonly worth: Readonly<Record<PlayerId, number>>;
}

export interface GameStats {
  /** Un punto al empezar cada ronda y uno al final de la partida. */
  readonly worthByRound: readonly WorthPoint[];
  readonly players: Readonly<Record<PlayerId, PlayerStats>>;
  /** Alquiler cobrado en cada casilla (solo las que cobraron algo). */
  readonly rentByTile: Readonly<Record<number, number>>;
  /** Cuántas veces cayó alguien en cada casilla (índice = casilla). */
  readonly landings: readonly number[];
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const BOARD_SIZE = 40;

const worthOf = (state: DeepReadonly<GameState>): Record<PlayerId, number> =>
  Object.fromEntries(
    state.turnOrder.map((id) => [
      id,
      state.players[id]?.bankrupt === true ? 0 : netWorth(state, id),
    ]),
  );

/** Estadísticas en cero para una partida recién creada. */
export function emptyStats(state: DeepReadonly<GameState>): GameStats {
  return {
    worthByRound: [{ round: state.round, worth: worthOf(state) }],
    players: Object.fromEntries(
      state.turnOrder.map((id) => [
        id,
        { collected: 0, paid: 0, rentCollected: 0, rentPaid: 0, jailVisits: 0 },
      ]),
    ),
    rentByTile: {},
    landings: new Array<number>(BOARD_SIZE).fill(0),
  };
}

/**
 * Suma una tanda de eventos. `after` es el estado que dejó la acción (para el
 * patrimonio). Devuelve un objeto nuevo: `stats` no se toca.
 */
export function recordStats(
  stats: GameStats,
  after: DeepReadonly<GameState>,
  events: readonly GameEvent[],
): GameStats {
  const players: Record<PlayerId, Mutable<PlayerStats>> = Object.fromEntries(
    Object.entries(stats.players).map(([id, player]) => [id, { ...player }]),
  );
  const rentByTile: Record<number, number> = { ...stats.rentByTile };
  const landings = [...stats.landings];
  const worthByRound = [...stats.worthByRound];

  for (const event of events) {
    switch (event.type) {
      case 'moneyTransferred': {
        const from = players[event.from];
        const to = players[event.to];
        if (from !== undefined) from.paid += event.amount;
        if (to !== undefined) to.collected += event.amount;
        if (event.reason !== 'rent') break;
        if (from !== undefined) from.rentPaid += event.amount;
        if (to !== undefined) to.rentCollected += event.amount;
        if (event.tile !== undefined) {
          rentByTile[event.tile] = (rentByTile[event.tile] ?? 0) + event.amount;
        }
        break;
      }
      case 'landed':
        landings[event.tile] = (landings[event.tile] ?? 0) + 1;
        break;
      case 'sentToJail': {
        const player = players[event.playerId];
        if (player !== undefined) player.jailVisits += 1;
        break;
      }
      case 'roundStarted':
        worthByRound.push({ round: event.round, worth: worthOf(after) });
        break;
      case 'gameOver':
        worthByRound.push({ round: after.round, worth: worthOf(after) });
        break;
      default:
        break;
    }
  }
  return { worthByRound, players, rentByTile, landings };
}
