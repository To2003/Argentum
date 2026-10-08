import { expect } from 'vitest';
import type { DeckKind, RulesConfig } from '@gran-negocio/shared';
import { DEFAULT_RULES, resolveRules } from '@gran-negocio/shared';
import {
  applyAction,
  createGame,
  createRng,
  rollDice,
  type Action,
  type Dice,
  type GameEvent,
  type GameState,
  type OwnedProperty,
  type Phase,
  type PlayerId,
  type RngState,
} from '../src/index.js';

export const SEED = '0123456789abcdef0123456789abcdef';

/** Una partida nueva con jugadores p1…pn, ya con p1 de turno (se reordena a mano). */
export function newGame(players = 2, rules: Partial<RulesConfig> = {}, seed = SEED): GameState {
  const { state } = createGame({
    seed,
    rules: resolveRules(rules, DEFAULT_RULES),
    players: Array.from({ length: players }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Jugador ${i + 1}`,
      tokenId: `token${i + 1}`,
    })),
  });
  // Los tests quieren un orden conocido: p1, p2, … y p1 de turno.
  state.turnOrder = Object.keys(state.players);
  state.currentPlayerId = 'p1';
  state.phase = { kind: 'waitingRoll' };
  return state;
}

const sameDice = (a: Dice, b: Dice) => a[0] === b[0] && a[1] === b[1];

/**
 * Un `rngState` con el que las próximas tiradas salen exactamente `rolls`.
 * Busca por fuerza bruta: 1/36 por tirada, así que hasta 3 tiradas es
 * instantáneo. Así el engine no necesita ningún gancho para tests.
 */
export function rigDice(...rolls: Dice[]): RngState {
  for (let i = 1; i < 5_000_000; i += 1) {
    // createRng mezcla (warm-up): los candidatos se comportan como estados al azar.
    const candidate = createRng(i.toString(16).padStart(32, '0'));
    let state = candidate;
    let ok = true;
    for (const wanted of rolls) {
      const draw = rollDice(state);
      if (!sameDice(draw.value, wanted)) {
        ok = false;
        break;
      }
      state = draw.state;
    }
    if (ok) return candidate;
  }
  throw new Error('rigDice: no encontré estado');
}

/** Muta el estado para que las próximas tiradas sean `rolls`. */
export function withDice(state: GameState, ...rolls: Dice[]): GameState {
  state.rngState = rigDice(...rolls);
  return state;
}

/** Aplica y exige que se acepte. */
export function act(
  state: GameState,
  playerId: PlayerId,
  action: Action,
): { state: GameState; events: readonly GameEvent[] } {
  const result = applyAction(state, playerId, action);
  if (!result.ok) throw new Error(`acción rechazada: ${action.type} → ${result.error}`);
  return { state: result.state, events: result.events };
}

/** Tira con dados forzados. */
export function roll(state: GameState, playerId: PlayerId, ...rolls: Dice[]) {
  return act(withDice(state, ...rolls), playerId, { type: 'rollDice' });
}

export function own(
  state: GameState,
  tile: number,
  ownerId: PlayerId,
  extra: Partial<OwnedProperty> = {},
): GameState {
  state.properties[tile] = { ownerId, houses: 0, mortgaged: false, ...extra };
  return state;
}

export function place(state: GameState, playerId: PlayerId, position: number): GameState {
  const player = state.players[playerId];
  if (player === undefined) throw new Error(playerId);
  player.position = position;
  return state;
}

export function setCash(state: GameState, playerId: PlayerId, cash: number): GameState {
  const player = state.players[playerId];
  if (player === undefined) throw new Error(playerId);
  player.cash = cash;
  return state;
}

/** Pone una carta arriba del mazo (y la saca de donde estaba). */
export function topCard(state: GameState, deck: DeckKind, cardId: string): GameState {
  state.decks[deck] = [cardId, ...state.decks[deck].filter((id) => id !== cardId)];
  return state;
}

export function cash(state: GameState, playerId: PlayerId): number {
  return state.players[playerId]?.cash ?? Number.NaN;
}

export function phaseKind(state: GameState): Phase['kind'] {
  return state.phase.kind;
}

export function eventsOf<T extends GameEvent['type']>(
  events: readonly GameEvent[],
  type: T,
): Extract<GameEvent, { type: T }>[] {
  return events.filter((event): event is Extract<GameEvent, { type: T }> => event.type === type);
}

export function expectRejected(
  state: GameState,
  playerId: PlayerId,
  action: Action,
  error: string,
): void {
  const result = applyAction(state, playerId, action);
  expect(result).toEqual({ ok: false, error });
}
