import { describe, expect, it } from 'vitest';
import { act, cash, eventsOf, newGame, own, phaseKind, place, roll, setCash } from './support.js';

describe('quiebra', () => {
  it('ante el banco: efectivo al banco, propiedades sin dueño, "Salí gratis" al fondo de su mazo', () => {
    const state = own(own(setCash(newGame(3), 'p1', 100), 1, 'p1'), 6, 'p1', { mortgaged: true });
    state.players['p1']!.jailFreeCards = ['chance.jailFree'];
    state.decks.chance = state.decks.chance.filter((id) => id !== 'chance.jailFree');
    const debt = roll(state, 'p1', [1, 3]).state; // Ganancias: $200
    expect(phaseKind(debt)).toBe('inDebt');
    const { state: after, events } = act(debt, 'p1', { type: 'declareBankruptcy' });
    expect(after.players['p1']).toMatchObject({ bankrupt: true, cash: 0, jailFreeCards: [] });
    expect(after.properties[1]).toBeUndefined();
    expect(after.properties[6]).toBeUndefined();
    expect(after.decks.chance.at(-1)).toBe('chance.jailFree');
    expect(eventsOf(events, 'moneyTransferred').find((e) => e.from === 'p1')).toMatchObject({
      to: 'bank',
      amount: 100,
    });
    // El turno pasa al siguiente y, ya en su turno, se subastan las propiedades
    // una por una (SPEC §5.7), sin hipoteca.
    expect(after.currentPlayerId).toBe('p2');
    expect(after.phase).toMatchObject({
      kind: 'auction',
      lot: { kind: 'property', tile: 1 },
      queue: [6],
      participants: ['p2', 'p3'],
    });
    const first = act(act(after, 'p2', { type: 'passAuction' }).state, 'p3', {
      type: 'passAuction',
    }).state;
    expect(first.phase).toMatchObject({ kind: 'auction', lot: { kind: 'property', tile: 6 } });
    const second = act(act(first, 'p2', { type: 'bid', amount: 10 }).state, 'p3', {
      type: 'passAuction',
    }).state;
    expect(second.properties[6]).toEqual({ ownerId: 'p2', houses: 0, mortgaged: false });
    expect(second.properties[1]).toBeUndefined();
    expect(phaseKind(second)).toBe('waitingRoll');
    expect(second.currentPlayerId).toBe('p2');
  });

  it('ante un jugador: se lleva efectivo, propiedades y cartas', () => {
    const state = own(own(setCash(newGame(3), 'p1', 30), 1, 'p1'), 39, 'p2', { houses: 1 });
    state.players['p1']!.jailFreeCards = ['community.jailFree'];
    place(state, 'p1', 36);
    const debt = roll(state, 'p1', [1, 2]).state; // 39 con una casa: $200
    expect(debt.phase).toMatchObject({ kind: 'inDebt', debts: [{ creditor: 'p2', amount: 200 }] });
    const { state: after } = act(debt, 'p1', { type: 'declareBankruptcy' });
    expect(cash(after, 'p2')).toBe(1530);
    expect(after.properties[1]?.ownerId).toBe('p2');
    expect(after.players['p2']?.jailFreeCards).toEqual(['community.jailFree']);
  });

  it('los edificios del quebrado vuelven al banco; ante un jugador, la mitad de su costo va al acreedor', () => {
    const state = own(own(setCash(newGame(3), 'p1', 0), 1, 'p1', { houses: 2 }), 3, 'p1', {
      houses: 5,
    });
    state.bank = { houses: 30, hotels: 11 };
    own(state, 39, 'p2');
    place(state, 'p1', 36);
    const debt = roll(state, 'p1', [1, 2]).state;
    const { state: after } = act(debt, 'p1', { type: 'declareBankruptcy' });
    expect(after.bank).toEqual({ houses: 32, hotels: 12 });
    // (2 + 5) × $50 × 50 % = $175
    expect(cash(after, 'p2')).toBe(1500 + 175);
    expect(after.properties[1]).toMatchObject({ ownerId: 'p2', houses: 0 });
  });

  it('cuando queda uno solo, termina la partida', () => {
    const debt = roll(setCash(newGame(2), 'p1', 10), 'p1', [1, 3]).state;
    const { state, events } = act(debt, 'p1', { type: 'declareBankruptcy' });
    expect(state.phase).toEqual({ kind: 'gameOver', winnerId: 'p2', reason: 'lastStanding' });
    expect(eventsOf(events, 'gameOver')[0]?.winnerId).toBe('p2');
    expect(act.bind(null, state, 'p2', { type: 'rollDice' })).toThrow(/GAME_OVER/);
  });

  it('el quebrado no vuelve a jugar', () => {
    const debt = roll(
      setCash(newGame(3, { auctionOnDecline: false }), 'p2', 10),
      'p1',
      [1, 3],
    ).state;
    // p1 pagó Ganancias; ahora le toca a p2, que va a quebrar.
    const p2Turn = act(debt, 'p1', { type: 'endTurn' }).state;
    const p2Debt = roll(p2Turn, 'p2', [1, 3]).state;
    const after = act(p2Debt, 'p2', { type: 'declareBankruptcy' }).state;
    expect(after.currentPlayerId).toBe('p3');
    const back = act(roll(after, 'p3', [1, 2]).state, 'p3', { type: 'declineProperty' }).state;
    expect(act(back, 'p3', { type: 'endTurn' }).state.currentPlayerId).toBe('p1');
  });
});
