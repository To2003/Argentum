import { describe, expect, it } from 'vitest';
import { netWorth } from '../src/index.js';
import { act, eventsOf, expectRejected, newGame, own, roll } from './support.js';

describe('patrimonio neto (SPEC §5.8)', () => {
  it('efectivo + precio de las propiedades + edificios al costo; hipotecada = su valor de hipoteca', () => {
    const state = own(
      own(own(newGame(), 1, 'p1', { houses: 2 }), 3, 'p1', { houses: 5 }),
      39,
      'p1',
      {
        mortgaged: true,
      },
    );
    // 1500 + 60 + 2×50 + 60 + 5×50 + (400 − 200)
    expect(netWorth(state, 'p1')).toBe(1500 + 60 + 100 + 60 + 250 + 200);
    expect(netWorth(state, 'p2')).toBe(1500);
  });
});

describe('fin por rondas', () => {
  it('al pasarse de maxRounds gana el de mayor patrimonio', () => {
    let state = own(newGame(2, { maxRounds: 5, auctionOnDecline: false }), 39, 'p2');
    state.round = 5;
    state.currentPlayerId = 'p2';
    state = roll(state, 'p2', [1, 3]).state; // Ganancias
    const { state: over, events } = act(state, 'p2', { type: 'endTurn' });
    expect(over.phase).toEqual({ kind: 'gameOver', winnerId: 'p2', reason: 'rounds' });
    expect(eventsOf(events, 'roundStarted')[0]?.round).toBe(6);
    expect(eventsOf(events, 'gameOver')[0]?.netWorth).toEqual({ p1: 1500, p2: 1300 + 400 });
  });

  it('una ronda empieza cada vez que el turno vuelve al primero del orden', () => {
    let state = roll(newGame(2), 'p1', [1, 3]).state;
    state = act(state, 'p1', { type: 'endTurn' }).state;
    expect(state.round).toBe(1);
    state = roll(state, 'p2', [1, 3]).state;
    const { state: next, events } = act(state, 'p2', { type: 'endTurn' });
    expect(next.round).toBe(2);
    expect(eventsOf(events, 'roundStarted')).toHaveLength(1);
  });

  it('empate de patrimonio: gana el de más efectivo, y si sigue, el primero en el orden', () => {
    let state = newGame(2, { maxRounds: 5 });
    state.round = 5;
    state.currentPlayerId = 'p2';
    state.phase = { kind: 'postRoll' };
    state = act(state, 'p2', { type: 'endTurn' }).state;
    expect(state.phase).toMatchObject({ winnerId: 'p1' });
  });
});

it('system es un id reservado: ningún jugador puede llamarse así', async () => {
  const { RESERVED_PLAYER_IDS } = await import('../src/index.js');
  expect(RESERVED_PLAYER_IDS).toContain('system');
});

describe('fin por tiempo', () => {
  it('solo el actor system, y solo si la sala tiene partida corta', () => {
    expectRejected(newGame(2), 'system', { type: 'timeUp' }, 'WRONG_PHASE');
    const timed = newGame(2, { gameDurationMinutes: 30 });
    expectRejected(timed, 'p1', { type: 'timeUp' }, 'NOT_YOUR_TURN');
    const { state } = act(own(timed, 39, 'p2'), 'system', { type: 'timeUp' });
    expect(state.phase).toEqual({ kind: 'gameOver', winnerId: 'p2', reason: 'time' });
  });

  it('corta también una subasta en curso', () => {
    const timed = newGame(2, { gameDurationMinutes: 30 });
    const declined = act(roll(timed, 'p1', [1, 2]).state, 'p1', { type: 'declineProperty' }).state;
    expect(declined.phase.kind).toBe('auction');
    expect(act(declined, 'system', { type: 'timeUp' }).state.phase.kind).toBe('gameOver');
  });
});

it('desempate: mismo patrimonio, gana el de más efectivo', () => {
  // p1: $1460 + Caminito ($60) = 1520; p2: $1520 en efectivo.
  let state = own(newGame(2, { maxRounds: 5 }), 1, 'p1');
  state.players['p1']!.cash = 1460;
  state.players['p2']!.cash = 1520;
  state.round = 5;
  state.currentPlayerId = 'p2';
  state.phase = { kind: 'postRoll' };
  state = act(state, 'p2', { type: 'endTurn' }).state;
  expect(state.phase).toMatchObject({ winnerId: 'p2', reason: 'rounds' });
});
