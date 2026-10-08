import { describe, expect, it } from 'vitest';
import { rentFor } from '../src/index.js';
import { cash, eventsOf, newGame, own, place, roll, setCash } from './support.js';

describe('alquiler de propiedades', () => {
  it('cobra el alquiler base al dueño', () => {
    const state = own(newGame(), 3, 'p2');
    const after = roll(state, 'p1', [1, 2]).state;
    expect(cash(after, 'p1')).toBe(1500 - 4);
    expect(cash(after, 'p2')).toBe(1504);
  });

  it('con el grupo completo y sin construir, alquiler base ×2', () => {
    const state = own(own(newGame(), 1, 'p2'), 3, 'p2');
    expect(rentFor(state, 3, 7)).toBe(8);
    expect(
      rentFor({ ...state, rules: { ...state.rules, doubleRentOnMonopoly: false } }, 3, 7),
    ).toBe(4);
  });

  it('sigue siendo ×2 si otra del grupo está hipotecada (SPEC §15.4 #4)', () => {
    const state = own(own(newGame(), 1, 'p2', { mortgaged: true }), 3, 'p2');
    expect(rentFor(state, 3, 7)).toBe(8);
  });

  it('una hipotecada no cobra', () => {
    const state = own(newGame(), 3, 'p2', { mortgaged: true });
    expect(rentFor(state, 3, 7)).toBe(0);
    const after = roll(state, 'p1', [1, 2]).state;
    expect(cash(after, 'p1')).toBe(1500);
  });

  it('con casas y hotel usa la tabla', () => {
    const state = newGame();
    for (const houses of [1, 2, 3, 4, 5] as const) {
      own(state, 39, 'p2', { houses });
      expect(rentFor(state, 39, 7)).toBe([50, 200, 600, 1400, 1700, 2000][houses]);
    }
  });

  it('caer en una propia no paga nada', () => {
    const state = own(newGame(), 3, 'p1');
    const { events } = roll(state, 'p1', [1, 2]);
    expect(eventsOf(events, 'moneyTransferred')).toHaveLength(0);
  });

  it('el dueño preso igual cobra (SPEC §5.3)', () => {
    const state = own(newGame(), 3, 'p2');
    state.players['p2']!.inJail = true;
    state.players['p2']!.position = 10;
    expect(cash(roll(state, 'p1', [1, 2]).state, 'p2')).toBe(1504);
  });
});

describe('alquiler de subtes', () => {
  it.each([
    [1, 25],
    [2, 50],
    [3, 100],
    [4, 200],
  ])('con %i línea(s) cobra %i', (count, rent) => {
    const state = newGame();
    for (const tile of [5, 15, 25, 35].slice(0, count)) own(state, tile, 'p2');
    expect(rentFor(state, 5, 7)).toBe(rent);
  });

  it('las hipotecadas cuentan para el multiplicador (SPEC §15.4 #5)', () => {
    const state = own(own(newGame(), 5, 'p2'), 15, 'p2', { mortgaged: true });
    expect(rentFor(state, 5, 7)).toBe(50);
  });
});

describe('alquiler de servicios', () => {
  it('con uno: 4× los dados del movimiento', () => {
    const state = own(place(newGame(), 'p1', 7), 12, 'p2');
    const after = roll(state, 'p1', [2, 3]).state;
    expect(cash(after, 'p1')).toBe(1500 - 20);
  });

  it('con los dos: 10× los dados', () => {
    const state = own(own(place(newGame(), 'p1', 7), 12, 'p2'), 28, 'p2');
    const after = roll(state, 'p1', [2, 3]).state;
    expect(cash(after, 'p1')).toBe(1500 - 50);
  });
});

describe('impuestos y pozo', () => {
  it('Ganancias cobra $200 y Lujo $100, al banco', () => {
    const income = roll(newGame(), 'p1', [1, 3]);
    expect(cash(income.state, 'p1')).toBe(1300);
    expect(eventsOf(income.events, 'moneyTransferred')[0]).toMatchObject({
      to: 'bank',
      reason: 'tax',
      tile: 4,
    });
    const luxury = roll(place(newGame(), 'p1', 35), 'p1', [1, 2]);
    expect(cash(luxury.state, 'p1')).toBe(1400);
  });

  it('con freeParkingPot el impuesto va al pozo y lo cobra quien cae en el descanso', () => {
    const taxed = roll(newGame(2, { freeParkingPot: true }), 'p1', [1, 3]).state;
    expect(taxed.pot).toBe(200);
    taxed.currentPlayerId = 'p2';
    taxed.phase = { kind: 'waitingRoll' };
    const collected = roll(place(taxed, 'p2', 15), 'p2', [2, 3]);
    expect(collected.state.pot).toBe(0);
    expect(cash(collected.state, 'p2')).toBe(1700);
    expect(eventsOf(collected.events, 'moneyTransferred').at(-1)).toMatchObject({
      from: 'pot',
      reason: 'pot',
    });
  });

  it('sin la regla, el descanso no da nada', () => {
    const { events } = roll(place(newGame(), 'p1', 15), 'p1', [2, 3]);
    expect(eventsOf(events, 'moneyTransferred')).toHaveLength(0);
  });

  it('un impuesto impagable abre una deuda con el banco', () => {
    const state = setCash(newGame(), 'p1', 150);
    const { state: after } = roll(state, 'p1', [1, 3]);
    expect(after.phase).toMatchObject({
      kind: 'inDebt',
      debts: [{ debtorId: 'p1', creditor: 'bank', amount: 200, reason: 'tax' }],
    });
    expect(cash(after, 'p1')).toBe(150);
  });
});
