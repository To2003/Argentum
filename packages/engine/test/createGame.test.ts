import fc from 'fast-check';
import { DEFAULT_RULES, DECKS } from '@gran-negocio/shared';
import { describe, expect, it } from 'vitest';
import { createGame, type GameEvent } from '../src/index.js';
import { SEED } from './support.js';

const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `J${i + 1}`,
    tokenId: `t${i + 1}`,
  }));

const seedArb = fc
  .array(fc.integer({ min: 0, max: 15 }), { minLength: 32, maxLength: 32 })
  .map((digits) => digits.map((d) => d.toString(16)).join(''));

/** Reconstruye el orden a partir de las tiradas emitidas, con la regla de §5.1. */
function orderFromEvents(events: readonly GameEvent[], ids: string[]): string[] {
  const rolls = events.filter((e) => e.type === 'diceRolled' && e.reason === 'turnOrder');
  let cursor = 0;
  const decide = (group: string[]): string[] => {
    if (group.length <= 1) return group;
    const totals = new Map<string, number>();
    for (const id of group) {
      const event = rolls[cursor++];
      if (event?.type !== 'diceRolled' || event.playerId !== id)
        throw new Error('orden de tiradas');
      totals.set(id, event.dice[0] + event.dice[1]);
    }
    return [...new Set(totals.values())]
      .sort((a, b) => b - a)
      .flatMap((total) => decide(group.filter((id) => totals.get(id) === total)));
  };
  const order = decide(ids);
  expect(cursor).toBe(rolls.length);
  return order;
}

describe('createGame', () => {
  it('estado inicial (SPEC §5.1)', () => {
    const { state } = createGame({ seed: SEED, players: players(4) });
    expect(Object.values(state.players).map((p) => p.cash)).toEqual([1500, 1500, 1500, 1500]);
    expect(state.bank).toEqual({ houses: 32, hotels: 12 });
    expect(state.properties).toEqual({});
    expect(state.pot).toBe(0);
    expect(state.version).toBe(0);
    expect(state.turnNumber).toBe(1);
    expect(state.phase).toEqual({ kind: 'waitingRoll' });
    expect(state.currentPlayerId).toBe(state.turnOrder[0]);
    expect(state.rules).toEqual(DEFAULT_RULES);
  });

  it('baraja los dos mazos (permutación de los 16)', () => {
    const { state } = createGame({ seed: SEED, players: players(2) });
    expect([...state.decks.chance].sort()).toEqual(DECKS.chance.map((c) => c.id).sort());
    expect(state.decks.chance).not.toEqual(DECKS.chance.map((c) => c.id));
  });

  it('orden de turno: suma de 2 dados, de mayor a menor; los empatados re-tiran entre ellos', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 2, max: 6 }), (seed, n) => {
        const ids = players(n).map((p) => p.id);
        const { state, events } = createGame({ seed, players: players(n) });
        expect(state.turnOrder).toEqual(orderFromEvents(events, ids));
        expect([...state.turnOrder].sort()).toEqual([...ids].sort());
        const decided = events.find((e) => e.type === 'turnOrderDecided');
        expect(decided).toEqual({ type: 'turnOrderDecided', order: state.turnOrder });
      }),
      { numRuns: 200 },
    );
  });

  it('con un empate, re-tiran solo los empatados', () => {
    // Buscar un seed con empate en la primera ronda entre 3 jugadores.
    for (let i = 0; i < 5000; i += 1) {
      const seed = i.toString(16).padStart(32, '0');
      const { events } = createGame({ seed, players: players(3) });
      const rolls = events.filter((e) => e.type === 'diceRolled');
      if (rolls.length <= 3) continue;
      const totals = rolls.slice(0, 3).map((e) => e.dice[0] + e.dice[1]);
      const rerollers = rolls.slice(3).map((e) => e.playerId);
      const tiedIds = ['p1', 'p2', 'p3'].filter(
        (_, k) => totals.filter((t) => t === totals[k]).length > 1,
      );
      expect(new Set(rerollers)).toEqual(new Set(tiedIds));
      return;
    }
    throw new Error('no encontré un seed con empate');
  });

  it('rechaza setups inválidos', () => {
    expect(() => createGame({ seed: SEED, players: players(1) })).toThrow(RangeError);
    expect(() => createGame({ seed: SEED, players: players(7) })).toThrow(RangeError);
    expect(() =>
      createGame({ seed: SEED, players: [...players(2), { id: 'p1', name: 'X', tokenId: 'x' }] }),
    ).toThrow(RangeError);
    expect(() =>
      createGame({ seed: SEED, players: players(4), rules: { ...DEFAULT_RULES, maxPlayers: 3 } }),
    ).toThrow(RangeError);
    expect(() => createGame({ seed: 'nope', players: players(2) })).toThrow(RangeError);
  });
});

it('rechaza ids reservados para el banco, el pozo y el mazo', () => {
  for (const id of ['bank', 'pot', 'deck']) {
    expect(() =>
      createGame({ seed: SEED, players: [...players(1), { id, name: id, tokenId: id }] }),
    ).toThrow(/reservado/);
  }
});
