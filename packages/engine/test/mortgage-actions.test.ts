import { describe, expect, it } from 'vitest';
import { act, cash, eventsOf, expectRejected, newGame, own } from './support.js';

const postRoll = () => {
  const state = newGame(3);
  state.phase = { kind: 'postRoll' };
  return state;
};

describe('hipotecas (SPEC §5.5)', () => {
  it('hipotecar cobra el 50 % del precio', () => {
    const { state, events } = act(own(postRoll(), 39, 'p1'), 'p1', { type: 'mortgage', tile: 39 });
    expect(state.properties[39]?.mortgaged).toBe(true);
    expect(cash(state, 'p1')).toBe(1700);
    expect(eventsOf(events, 'propertyMortgaged')).toHaveLength(1);
  });

  it('con edificios en el grupo hay que venderlos antes', () => {
    const state = own(own(postRoll(), 1, 'p1', { houses: 1 }), 3, 'p1', { houses: 1 });
    state.bank.houses = 30;
    expectRejected(state, 'p1', { type: 'mortgage', tile: 3 }, 'HAS_BUILDINGS');
  });

  it('no se hipoteca dos veces ni una ajena ni una casilla que no es propiedad', () => {
    const state = own(own(postRoll(), 39, 'p1', { mortgaged: true }), 37, 'p2');
    expectRejected(state, 'p1', { type: 'mortgage', tile: 39 }, 'ALREADY_MORTGAGED');
    expectRejected(state, 'p1', { type: 'mortgage', tile: 37 }, 'NOT_OWNER');
    expectRejected(state, 'p1', { type: 'mortgage', tile: 0 }, 'INVALID_TILE');
    expectRejected(state, 'p1', { type: 'mortgage', tile: 99 }, 'INVALID_TILE');
  });

  it('subtes y servicios también se hipotecan', () => {
    const state = own(own(postRoll(), 5, 'p1'), 12, 'p1');
    const one = act(state, 'p1', { type: 'mortgage', tile: 5 }).state;
    expect(cash(act(one, 'p1', { type: 'mortgage', tile: 12 }).state, 'p1')).toBe(1500 + 100 + 75);
  });

  it('levantar la hipoteca cuesta valor + 10 % redondeado hacia arriba (AySA: $83)', () => {
    const state = own(postRoll(), 28, 'p1', { mortgaged: true });
    const { state: after, events } = act(state, 'p1', { type: 'unmortgage', tile: 28 });
    expect(after.properties[28]?.mortgaged).toBe(false);
    expect(cash(after, 'p1')).toBe(1500 - 83);
    expect(eventsOf(events, 'propertyUnmortgaged')).toHaveLength(1);
  });

  it('levantar sin plata o una no hipotecada, no', () => {
    const state = own(own(postRoll(), 28, 'p1', { mortgaged: true }), 12, 'p1');
    state.players['p1']!.cash = 82;
    expectRejected(state, 'p1', { type: 'unmortgage', tile: 28 }, 'INSUFFICIENT_FUNDS');
    expectRejected(state, 'p1', { type: 'unmortgage', tile: 12 }, 'NOT_MORTGAGED');
    expectRejected(state, 'p1', { type: 'unmortgage', tile: 4 }, 'INVALID_TILE');
  });

  it('se puede hipotecar para juntar plata y comprar (SPEC §15.4 #11)', () => {
    const state = own(newGame(), 39, 'p1');
    // $150 + $200 de la hipoteca de Puerto Madero = $350, el precio del Obelisco.
    state.players['p1']!.cash = 150;
    state.phase = { kind: 'awaitingPurchase', tile: 37 };
    expectRejected(state, 'p1', { type: 'buyProperty' }, 'INSUFFICIENT_FUNDS');
    const raised = act(state, 'p1', { type: 'mortgage', tile: 39 }).state;
    expect(act(raised, 'p1', { type: 'buyProperty' }).state.properties[37]?.ownerId).toBe('p1');
  });
});

describe('deuda: juntar plata y pagar', () => {
  it('el deudor hipoteca, paga con payDebt y el turno sigue', () => {
    const state = own(newGame(3), 39, 'p1');
    state.players['p1']!.cash = 100;
    state.phase = {
      kind: 'inDebt',
      debts: [{ debtorId: 'p1', creditor: 'p2', amount: 200, reason: 'rent' }],
      returnTo: { kind: 'finishResolution' },
    };
    expectRejected(state, 'p1', { type: 'payDebt' }, 'DEBT_NOT_COVERED');
    expectRejected(state, 'p1', { type: 'unmortgage', tile: 39 }, 'WRONG_PHASE');
    const raised = act(state, 'p1', { type: 'mortgage', tile: 39 }).state;
    const { state: paid, events } = act(raised, 'p1', { type: 'payDebt' });
    expect(cash(paid, 'p1')).toBe(100);
    expect(cash(paid, 'p2')).toBe(1700);
    expect(eventsOf(events, 'debtPaid')).toHaveLength(1);
    expect(paid.phase.kind).toBe('postRoll');
  });

  it('el 3.er intento de cárcel con deuda pagada mueve con la tirada guardada', () => {
    const state = own(newGame(2), 39, 'p1');
    const p1 = state.players['p1']!;
    p1.cash = 0;
    p1.inJail = true;
    p1.position = 10;
    state.phase = {
      kind: 'inDebt',
      debts: [{ debtorId: 'p1', creditor: 'bank', amount: 50, reason: 'jailFine' }],
      returnTo: { kind: 'moveAfterJailFine', dice: [1, 3] },
    };
    const raised = act(state, 'p1', { type: 'mortgage', tile: 39 }).state;
    const { state: paid } = act(raised, 'p1', { type: 'payDebt' });
    expect(paid.players['p1']).toMatchObject({ inJail: false, position: 14 });
    expect(paid.phase).toEqual({ kind: 'awaitingPurchase', tile: 14 });
  });

  it('quiebra ante un jugador con hipotecadas: el acreedor paga el 10 %', () => {
    const state = own(own(newGame(3), 39, 'p1', { mortgaged: true }), 28, 'p1', {
      mortgaged: true,
    });
    state.players['p1']!.cash = 0;
    state.phase = {
      kind: 'inDebt',
      debts: [{ debtorId: 'p1', creditor: 'p2', amount: 500, reason: 'rent' }],
      returnTo: { kind: 'finishResolution' },
    };
    state.currentPlayerId = 'p3';
    const { state: after, events } = act(state, 'p1', { type: 'declareBankruptcy' });
    expect(after.properties[39]).toEqual({ ownerId: 'p2', houses: 0, mortgaged: true });
    // 10 % de 200 + 10 % de 75 (redondeado) = 20 + 8
    expect(cash(after, 'p2')).toBe(1500 - 28);
    expect(
      eventsOf(events, 'moneyTransferred').filter((e) => e.reason === 'mortgageInterest'),
    ).toHaveLength(1);
  });

  it('si el acreedor no puede pagar el 10 %, queda él en deuda con el banco', () => {
    const state = own(newGame(3), 39, 'p1', { mortgaged: true });
    state.players['p1']!.cash = 0;
    state.players['p2']!.cash = 5;
    state.currentPlayerId = 'p3';
    state.phase = {
      kind: 'inDebt',
      debts: [{ debtorId: 'p1', creditor: 'p2', amount: 500, reason: 'rent' }],
      returnTo: { kind: 'finishResolution' },
    };
    const { state: after } = act(state, 'p1', { type: 'declareBankruptcy' });
    expect(after.phase).toMatchObject({
      kind: 'inDebt',
      debts: [{ debtorId: 'p2', creditor: 'bank', amount: 20, reason: 'mortgageInterest' }],
    });
  });
});
