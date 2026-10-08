import { describe, expect, it } from 'vitest';
import type { GameState, TradeBundle } from '../src/index.js';
import { act, cash, eventsOf, expectRejected, newGame, own } from './support.js';

const NONE: TradeBundle = { cash: 0, properties: [], jailFreeCards: [] };
const bundle = (partial: Partial<TradeBundle>): TradeBundle => ({ ...NONE, ...partial });

function ready(): GameState {
  const state = own(own(newGame(3), 1, 'p1'), 39, 'p2');
  state.phase = { kind: 'postRoll' };
  return state;
}

describe('trueques (SPEC §5.6)', () => {
  it('propone, el receptor acepta y se intercambia todo', () => {
    const proposed = act(ready(), 'p1', {
      type: 'proposeTrade',
      to: 'p2',
      offer: bundle({ properties: [1], cash: 100 }),
      request: bundle({ properties: [39] }),
    });
    expect(proposed.state.trade).toMatchObject({ id: 1, from: 'p1', to: 'p2' });
    expect(proposed.state.phase.kind).toBe('postRoll');
    const { state, events } = act(proposed.state, 'p2', { type: 'acceptTrade' });
    expect(state.properties[1]?.ownerId).toBe('p2');
    expect(state.properties[39]?.ownerId).toBe('p1');
    expect([cash(state, 'p1'), cash(state, 'p2')]).toEqual([1400, 1600]);
    expect(state.trade).toBeNull();
    expect(eventsOf(events, 'tradeAccepted')).toHaveLength(1);
  });

  it('el receptor responde fuera de turno; nadie más puede', () => {
    const { state } = act(ready(), 'p1', {
      type: 'proposeTrade',
      to: 'p2',
      offer: bundle({ cash: 10 }),
      request: NONE,
    });
    expectRejected(state, 'p3', { type: 'acceptTrade' }, 'NOT_YOUR_TURN');
    expectRejected(state, 'p1', { type: 'acceptTrade' }, 'NOT_YOUR_TURN');
    expectRejected(state, 'p2', { type: 'cancelTrade' }, 'NOT_YOUR_TURN');
  });

  it('rechazar y cancelar cierran el trueque', () => {
    const proposal = {
      type: 'proposeTrade',
      to: 'p2',
      offer: bundle({ cash: 10 }),
      request: NONE,
    } as const;
    const { state } = act(ready(), 'p1', proposal);
    const rejected = act(state, 'p2', { type: 'rejectTrade' });
    expect(rejected.state.trade).toBeNull();
    expect(eventsOf(rejected.events, 'tradeClosed')[0]?.reason).toBe('rejected');
    const cancelled = act(state, 'p1', { type: 'cancelTrade' });
    expect(eventsOf(cancelled.events, 'tradeClosed')[0]?.reason).toBe('cancelled');
  });

  it('contraoferta: se invierten los roles', () => {
    const { state } = act(ready(), 'p1', {
      type: 'proposeTrade',
      to: 'p2',
      offer: bundle({ cash: 10 }),
      request: bundle({ properties: [39] }),
    });
    const { state: countered, events } = act(state, 'p2', {
      type: 'counterTrade',
      offer: bundle({ properties: [39] }),
      request: bundle({ cash: 300 }),
    });
    expect(countered.trade).toMatchObject({ id: 2, from: 'p2', to: 'p1' });
    expect(eventsOf(events, 'tradeProposed')[0]?.counter).toBe(true);
    const done = act(countered, 'p1', { type: 'acceptTrade' }).state;
    expect(done.properties[39]?.ownerId).toBe('p1');
    expect(cash(done, 'p2')).toBe(1800);
  });

  it('solo lo que existe hoy, y sin edificios en el grupo', () => {
    const state = ready();
    const propose = (offer: TradeBundle, request: TradeBundle = NONE) =>
      ({ type: 'proposeTrade', to: 'p2', offer, request }) as const;
    expectRejected(state, 'p1', propose(bundle({ cash: 2000 })), 'INSUFFICIENT_FUNDS');
    expectRejected(state, 'p1', propose(bundle({ properties: [39] })), 'NOT_OWNER');
    expectRejected(
      state,
      'p1',
      propose(bundle({ jailFreeCards: ['chance.jailFree'] })),
      'NO_JAIL_CARD',
    );
    expectRejected(state, 'p1', propose(NONE), 'INVALID_TRADE');
    expectRejected(state, 'p1', propose(bundle({ cash: -1 })), 'INVALID_TRADE');
    expectRejected(state, 'p1', propose(bundle({ properties: [1, 1] })), 'INVALID_TRADE');
    expectRejected(state, 'p1', { ...propose(bundle({ cash: 1 })), to: 'p1' }, 'INVALID_TRADE');
    expectRejected(state, 'p1', { ...propose(bundle({ cash: 1 })), to: 'zz' }, 'UNKNOWN_PLAYER');
    own(state, 3, 'p1', { houses: 1 });
    state.properties[1]!.houses = 1;
    state.bank.houses = 30;
    expectRejected(state, 'p1', propose(bundle({ properties: [1] })), 'HAS_BUILDINGS');
  });

  it('un trueque a la vez, y solo el del turno (o el deudor) propone', () => {
    const proposal = {
      type: 'proposeTrade',
      to: 'p2',
      offer: bundle({ cash: 1 }),
      request: NONE,
    } as const;
    const { state } = act(ready(), 'p1', proposal);
    expectRejected(state, 'p1', { ...proposal, to: 'p3' }, 'TRADE_OPEN');
    expectRejected(ready(), 'p2', { ...proposal, to: 'p1' }, 'NOT_YOUR_TURN');
  });

  it('al aceptar revalida: si algo cambió, no se puede', () => {
    const { state } = act(ready(), 'p1', {
      type: 'proposeTrade',
      to: 'p2',
      offer: bundle({ cash: 1000 }),
      request: NONE,
    });
    state.players['p1']!.cash = 500;
    expectRejected(state, 'p2', { type: 'acceptTrade' }, 'INSUFFICIENT_FUNDS');
  });

  it('recibir una hipotecada cuesta el 10 % al aceptar (redondeado hacia arriba)', () => {
    const state = own(ready(), 28, 'p2', { mortgaged: true });
    const { state: proposed } = act(state, 'p1', {
      type: 'proposeTrade',
      to: 'p2',
      offer: bundle({ cash: 10 }),
      request: bundle({ properties: [28] }),
    });
    const done = act(proposed, 'p2', { type: 'acceptTrade' }).state;
    expect(done.properties[28]).toEqual({ ownerId: 'p1', houses: 0, mortgaged: true });
    expect(cash(done, 'p1')).toBe(1500 - 10 - 8);
  });

  it('no se puede aceptar una hipotecada sin plata para el 10 %', () => {
    const state = own(ready(), 28, 'p2', { mortgaged: true });
    state.players['p1']!.cash = 7;
    expectRejected(
      state,
      'p1',
      { type: 'proposeTrade', to: 'p2', offer: NONE, request: bundle({ properties: [28] }) },
      'INSUFFICIENT_FUNDS',
    );
  });

  it('las "Salí gratis" se pueden intercambiar', () => {
    const state = ready();
    state.players['p1']!.jailFreeCards = ['chance.jailFree'];
    const { state: proposed } = act(state, 'p1', {
      type: 'proposeTrade',
      to: 'p2',
      offer: bundle({ jailFreeCards: ['chance.jailFree'] }),
      request: bundle({ cash: 40 }),
    });
    const done = act(proposed, 'p2', { type: 'acceptTrade' }).state;
    expect(done.players['p2']?.jailFreeCards).toEqual(['chance.jailFree']);
    expect(done.players['p1']?.jailFreeCards).toEqual([]);
  });

  it('terminar el turno cancela el trueque abierto', () => {
    const { state } = act(ready(), 'p1', {
      type: 'proposeTrade',
      to: 'p2',
      offer: bundle({ cash: 1 }),
      request: NONE,
    });
    const { state: next, events } = act(state, 'p1', { type: 'endTurn' });
    expect(next.trade).toBeNull();
    expect(eventsOf(events, 'tradeClosed')[0]?.reason).toBe('cancelled');
  });

  it('el deudor puede vender por trueque para juntar plata', () => {
    const state = own(newGame(3), 39, 'p1');
    state.players['p1']!.cash = 0;
    state.phase = {
      kind: 'inDebt',
      debts: [{ debtorId: 'p1', creditor: 'bank', amount: 200, reason: 'tax' }],
      returnTo: { kind: 'finishResolution' },
    };
    const { state: proposed } = act(state, 'p1', {
      type: 'proposeTrade',
      to: 'p3',
      offer: bundle({ properties: [39] }),
      request: bundle({ cash: 300 }),
    });
    const sold = act(proposed, 'p3', { type: 'acceptTrade' }).state;
    expect(act(sold, 'p1', { type: 'payDebt' }).state.phase.kind).toBe('postRoll');
  });

  it('durante una subasta no se responde un trueque', () => {
    const state = ready();
    state.trade = { id: 9, from: 'p1', to: 'p2', offer: bundle({ cash: 1 }), request: NONE };
    state.phase = {
      kind: 'auction',
      lot: { kind: 'property', tile: 3 },
      participants: ['p1', 'p2', 'p3'],
      highBid: 0,
      highBidder: null,
      queue: [],
      returnTo: { kind: 'finishResolution' },
    };
    expectRejected(state, 'p2', { type: 'acceptTrade' }, 'WRONG_PHASE');
    expectRejected(state, 'p2', { type: 'rejectTrade' }, 'WRONG_PHASE');
    expect(act(state, 'p1', { type: 'cancelTrade' }).state.trade).toBeNull();
  });

  it('sin trueque abierto no hay nada que responder', () => {
    expectRejected(ready(), 'p2', { type: 'acceptTrade' }, 'NO_TRADE');
  });
});
