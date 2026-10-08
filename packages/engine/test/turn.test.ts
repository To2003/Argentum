import { describe, expect, it } from 'vitest';
import { act, cash, eventsOf, expectRejected, newGame, phaseKind, place, roll } from './support.js';

describe('movimiento y Salida', () => {
  it('mueve la suma de los dados y deja la casilla resuelta', () => {
    const { state, events } = roll(newGame(), 'p1', [2, 3]);
    expect(state.players['p1']?.position).toBe(5);
    expect(eventsOf(events, 'moved')[0]).toMatchObject({
      from: 0,
      to: 5,
      steps: 5,
      passedGo: false,
    });
    expect(eventsOf(events, 'landed')[0]).toMatchObject({ tile: 5 });
  });

  it('pasar por la Salida cobra el salario', () => {
    const { state, events } = roll(place(newGame(), 'p1', 38), 'p1', [3, 1]);
    expect(state.players['p1']?.position).toBe(2);
    expect(eventsOf(events, 'moved')[0]?.passedGo).toBe(true);
    expect(eventsOf(events, 'moneyTransferred')[0]).toMatchObject({
      from: 'bank',
      to: 'p1',
      amount: 200,
      reason: 'salary',
    });
  });

  it('caer justo en la Salida cobra una sola vez', () => {
    const { events } = roll(place(newGame(), 'p1', 33), 'p1', [3, 4]);
    expect(eventsOf(events, 'moneyTransferred').filter((e) => e.reason === 'salary')).toHaveLength(
      1,
    );
  });

  it('el salario sale de las reglas de la sala', () => {
    // 38 + 3 = 1 (Caminito, sin dueño): solo cobra la Salida.
    const { state } = roll(place(newGame(2, { salary: 300 }), 'p1', 38), 'p1', [1, 2]);
    expect(cash(state, 'p1')).toBe(1500 + 300);
  });
});

describe('dobles', () => {
  it('con dobles vuelve a tirar y no puede terminar el turno', () => {
    // 0 + 4 = Impuesto a las Ganancias (4): paga y sigue.
    const { state } = roll(newGame(), 'p1', [2, 2]);
    expect(phaseKind(state)).toBe('waitingRoll');
    expect(state.turn).toMatchObject({ doublesCount: 1, rollAgain: true });
    expectRejected(state, 'p1', { type: 'endTurn' }, 'WRONG_PHASE');
  });

  it('sin dobles pasa a postRoll y endTurn cede el turno', () => {
    const first = roll(newGame(), 'p1', [1, 3]);
    expect(phaseKind(first.state)).toBe('postRoll');
    const { state, events } = act(first.state, 'p1', { type: 'endTurn' });
    expect(state.currentPlayerId).toBe('p2');
    expect(state.turnNumber).toBe(2);
    expect(eventsOf(events, 'turnStarted')[0]).toMatchObject({ playerId: 'p2', turnNumber: 2 });
  });

  it('tres dobles seguidos: preso sin mover, y cierra con endTurn', () => {
    // Desde la Cárcel (de visita): 12 Edenor, 16 Monumento, ambas sin dueño.
    let state = place(newGame(), 'p1', 10);
    state = act(roll(state, 'p1', [1, 1]).state, 'p1', { type: 'declineProperty' }).state;
    expect(phaseKind(state)).toBe('waitingRoll');
    state = act(roll(state, 'p1', [2, 2]).state, 'p1', { type: 'declineProperty' }).state;
    expect(state.turn.doublesCount).toBe(2);
    const third = roll(state, 'p1', [3, 3]);
    expect(third.state.players['p1']).toMatchObject({ position: 10, inJail: true });
    expect(eventsOf(third.events, 'moved')).toHaveLength(0);
    expect(eventsOf(third.events, 'sentToJail')[0]?.cause).toBe('threeDoubles');
    expect(phaseKind(third.state)).toBe('postRoll');
    expect(third.state.turn).toMatchObject({ doublesCount: 0, rollAgain: false });
    expect(act(third.state, 'p1', { type: 'endTurn' }).state.currentPlayerId).toBe('p2');
  });

  it('caer en Vas preso con dobles corta la tirada extra (SPEC §15.4 #12)', () => {
    const { state, events } = roll(place(newGame(), 'p1', 26), 'p1', [2, 2]);
    expect(eventsOf(events, 'sentToJail')[0]?.cause).toBe('tile');
    expect(state.players['p1']).toMatchObject({ position: 10, inJail: true });
    expect(phaseKind(state)).toBe('postRoll');
    expect(state.turn).toMatchObject({ rollAgain: false, doublesCount: 0 });
    expect(state.currentPlayerId).toBe('p1');
  });
});

describe('compra', () => {
  it('cae en una propiedad sin dueño y la puede comprar', () => {
    const landed = roll(newGame(), 'p1', [1, 2]); // 3: San Telmo, $60
    expect(landed.state.phase).toEqual({ kind: 'awaitingPurchase', tile: 3 });
    const { state, events } = act(landed.state, 'p1', { type: 'buyProperty' });
    expect(state.properties[3]).toEqual({ ownerId: 'p1', houses: 0, mortgaged: false });
    expect(cash(state, 'p1')).toBe(1440);
    expect(eventsOf(events, 'propertyBought')).toHaveLength(1);
    expect(phaseKind(state)).toBe('postRoll');
  });

  it('sin efectivo suficiente solo puede rechazar', () => {
    const landed = roll(newGame(2, { startingCash: 500 }), 'p1', [1, 2]);
    landed.state.players['p1']!.cash = 59;
    expectRejected(landed.state, 'p1', { type: 'buyProperty' }, 'INSUFFICIENT_FUNDS');
  });

  it('rechazar deja la propiedad sin dueño y el turno sigue (TODO(M3): subasta)', () => {
    const landed = roll(newGame(), 'p1', [1, 2]);
    const { state, events } = act(landed.state, 'p1', { type: 'declineProperty' });
    expect(state.properties[3]).toBeUndefined();
    expect(eventsOf(events, 'purchaseDeclined')).toHaveLength(1);
    expect(phaseKind(state)).toBe('postRoll');
  });

  it('comprar con dobles pendientes vuelve a waitingRoll', () => {
    const landed = roll(place(newGame(), 'p1', 7), 'p1', [2, 2]); // 11: Tigre
    expect(landed.state.phase).toEqual({ kind: 'awaitingPurchase', tile: 11 });
    const { state } = act(landed.state, 'p1', { type: 'buyProperty' });
    expect(phaseKind(state)).toBe('waitingRoll');
  });
});
