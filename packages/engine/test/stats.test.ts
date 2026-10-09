import { describe, expect, it } from 'vitest';
import {
  actorsOf,
  applyAction,
  botAction,
  emptyStats,
  newBotMemory,
  recordStats,
  type GameState,
} from '../src/index.js';
import { newGame, own, roll } from './support.js';

describe('estadísticas de fin de partida (M9)', () => {
  it('arranca en cero, con el patrimonio inicial como primer punto', () => {
    const stats = emptyStats(newGame(3));
    expect(stats.worthByRound).toEqual([{ round: 1, worth: { p1: 1500, p2: 1500, p3: 1500 } }]);
    expect(stats.players['p1']).toEqual({
      collected: 0,
      paid: 0,
      rentCollected: 0,
      rentPaid: 0,
      jailVisits: 0,
    });
    expect(stats.landings).toHaveLength(40);
  });

  it('cuenta alquiler por casilla y por jugador, y la casilla pisada', () => {
    const state = own(newGame(2), 3, 'p2');
    const before = emptyStats(state);
    const { state: after, events } = roll(state, 'p1', [1, 2]);
    const stats = recordStats(before, after, events);
    expect(stats.landings[3]).toBe(1);
    expect(stats.rentByTile[3]).toBe(4);
    expect(stats.players['p1']).toMatchObject({ paid: 4, rentPaid: 4 });
    expect(stats.players['p2']).toMatchObject({ collected: 4, rentCollected: 4 });
    // No toca el objeto anterior.
    expect(before.landings[3]).toBe(0);
  });

  it('cuenta las veces preso', () => {
    const state = newGame(2);
    const p1 = state.players['p1'];
    if (p1 !== undefined) p1.position = 25;
    const { state: after, events } = roll(state, 'p1', [2, 3]); // Vas preso
    expect(recordStats(emptyStats(state), after, events).players['p1']?.jailVisits).toBe(1);
  });

  it('en una partida entera de bots cierra la contabilidad y es determinista', () => {
    const play = () => {
      let state: GameState = newGame(3);
      let stats = emptyStats(state);
      const memory = new Map(['p1', 'p2', 'p3'].map((id) => [id, newBotMemory()]));
      for (let step = 0; step < 20_000 && state.phase.kind !== 'gameOver'; step += 1) {
        const id = actorsOf(state)[0];
        if (id === undefined) break;
        const action = botAction(state, id, 'hard', memory.get(id) ?? newBotMemory());
        if (action === null) break;
        const result = applyAction(state, id, action);
        if (!result.ok) throw new Error(result.error);
        state = result.state;
        stats = recordStats(stats, state, result.events);
      }
      return { state, stats };
    };
    const { state, stats } = play();
    for (const player of Object.values(state.players)) {
      const own = stats.players[player.id];
      expect(1500 + (own?.collected ?? 0) - (own?.paid ?? 0)).toBe(player.cash);
    }
    expect(stats.worthByRound.length).toBeGreaterThan(1);
    expect(play().stats).toEqual(stats);
  });
});
