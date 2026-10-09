import { BOARD, DEFAULT_RULES, tileAt, type RulesConfig } from '@gran-negocio/shared';
import {
  actorsOf,
  applyAction,
  botAction,
  createGame,
  netWorth,
  newBotMemory,
  type BotDifficulty,
  type BotMemory,
  type GameEvent,
  type GameState,
} from '../src/index.js';

/**
 * Simulador de balance (SPEC.md §9): partidas bot contra bot, deterministas
 * (seed + bots sin azar), con métricas de duración, victorias, casillas más
 * pisadas y retorno por grupo.
 */
export interface GameResult {
  readonly seed: string;
  /** Dificultad de cada asiento, en el orden en que se sentaron. */
  readonly seats: readonly BotDifficulty[];
  /** Asiento ganador (índice en `seats`). */
  readonly winnerSeat: number;
  /** Lugar del ganador en el orden de turno (0 = el que empezó). */
  readonly winnerTurnPosition: number;
  readonly turns: number;
  /** false: llegó al tope de turnos y se decidió por patrimonio. */
  readonly finished: boolean;
  readonly landings: readonly number[];
  readonly rentByGroup: Readonly<Record<string, number>>;
  readonly investedByGroup: Readonly<Record<string, number>>;
}

/** Grupo de una casilla para el retorno: color, o subtes/servicios. */
export const groupKey = (index: number): string | null => {
  const tile = tileAt(index);
  if (tile.kind === 'property') return tile.group;
  if (tile.kind === 'subway') return 'subway';
  if (tile.kind === 'utility') return 'utility';
  return null;
};

/** Seeds reproducibles: base + i, como 128 bits en hex. */
export const seedFor = (base: string, i: number): string =>
  ((BigInt(`0x${base}`) + BigInt(i)) % 2n ** 128n).toString(16).padStart(32, '0');

const MAX_ACTIONS = 40_000;

export function playBotGame(
  seed: string,
  seats: readonly BotDifficulty[],
  maxTurns: number,
  rules: RulesConfig = DEFAULT_RULES,
): GameResult {
  const ids = seats.map((_, i) => `s${i}`);
  let state: GameState = createGame({
    seed,
    rules,
    players: ids.map((id) => ({ id, name: id, tokenId: id })),
  }).state;
  const memory = new Map<string, BotMemory>(ids.map((id) => [id, newBotMemory()]));
  const difficulty = new Map(ids.map((id, i) => [id, seats[i] ?? 'easy']));
  const landings = new Array<number>(BOARD.length).fill(0);
  const rent: Record<string, number> = {};
  const invested: Record<string, number> = {};

  const record = (events: readonly GameEvent[]) => {
    for (const event of events) {
      if (event.type === 'landed') landings[event.tile] = (landings[event.tile] ?? 0) + 1;
      if (event.type !== 'moneyTransferred' || event.tile === undefined) continue;
      const key = groupKey(event.tile);
      if (key === null) continue;
      if (event.reason === 'rent') rent[key] = (rent[key] ?? 0) + event.amount;
      if (event.reason === 'purchase' || event.reason === 'auction') {
        invested[key] = (invested[key] ?? 0) + event.amount;
      }
      if (event.reason === 'building') {
        // Construir es inversión (sale del jugador); vender la devuelve.
        invested[key] = (invested[key] ?? 0) + (event.to === 'bank' ? event.amount : -event.amount);
      }
    }
  };

  let actions = 0;
  while (state.phase.kind !== 'gameOver' && state.turnNumber <= maxTurns) {
    let moved = false;
    for (const id of actorsOf(state)) {
      const action = botAction(
        state,
        id,
        difficulty.get(id) ?? 'easy',
        memory.get(id) ?? newBotMemory(),
      );
      if (action === null) continue;
      const result = applyAction(state, id, action);
      if (!result.ok)
        throw new Error(`el bot ${id} propuso algo ilegal: ${action.type} → ${result.error}`);
      state = result.state;
      record(result.events);
      moved = true;
      break;
    }
    if (!moved) throw new Error(`nadie juega: fase ${state.phase.kind}`);
    actions += 1;
    if (actions > MAX_ACTIONS)
      throw new Error(`partida trabada después de ${MAX_ACTIONS} acciones`);
  }

  const finished = state.phase.kind === 'gameOver';
  let winner: string;
  if (state.phase.kind === 'gameOver' && state.phase.winnerId !== null) {
    winner = state.phase.winnerId;
  } else {
    const active = ids.filter((id) => state.players[id]?.bankrupt !== true);
    winner = active.reduce(
      (best, id) => (netWorth(state, id) > netWorth(state, best) ? id : best),
      active[0] ?? ids[0] ?? 's0',
    );
  }
  return {
    seed,
    seats,
    winnerSeat: ids.indexOf(winner),
    winnerTurnPosition: state.turnOrder.indexOf(winner),
    turns: state.turnNumber,
    finished,
    landings,
    rentByGroup: rent,
    investedByGroup: invested,
  };
}

export interface Matchup {
  readonly label: string;
  readonly seats: readonly BotDifficulty[];
}

export interface MatchupReport {
  readonly label: string;
  readonly games: number;
  /** Victorias por dificultad (sumando los asientos de esa dificultad). */
  readonly winsByDifficulty: Readonly<Record<BotDifficulty, number>>;
  readonly winsByTurnPosition: readonly number[];
  readonly averageTurns: number;
  readonly unfinishedRate: number;
  readonly results: readonly GameResult[];
}

/**
 * Juega `games` partidas de un enfrentamiento. Rota los asientos en cada
 * partida para que nadie tenga siempre la misma ventaja de sentarse primero.
 */
export function runMatchup(
  matchup: Matchup,
  games: number,
  seedBase: string,
  maxTurns: number,
): MatchupReport {
  const results: GameResult[] = [];
  const wins: Record<BotDifficulty, number> = { easy: 0, medium: 0, hard: 0 };
  const positions = new Array<number>(matchup.seats.length).fill(0);
  for (let i = 0; i < games; i += 1) {
    const shift = i % matchup.seats.length;
    const seats = [...matchup.seats.slice(shift), ...matchup.seats.slice(0, shift)];
    const result = playBotGame(seedFor(seedBase, i), seats, maxTurns);
    results.push(result);
    const winnerDifficulty = seats[result.winnerSeat];
    if (winnerDifficulty !== undefined) wins[winnerDifficulty] += 1;
    positions[result.winnerTurnPosition] = (positions[result.winnerTurnPosition] ?? 0) + 1;
  }
  return {
    label: matchup.label,
    games,
    winsByDifficulty: wins,
    winsByTurnPosition: positions,
    averageTurns: results.reduce((sum, r) => sum + r.turns, 0) / Math.max(1, games),
    unfinishedRate: results.filter((r) => !r.finished).length / Math.max(1, games),
    results,
  };
}
