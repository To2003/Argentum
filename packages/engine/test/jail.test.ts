import { describe, expect, it } from 'vitest';
import type { GameState } from '../src/index.js';
import {
  act,
  cash,
  eventsOf,
  expectRejected,
  newGame,
  own,
  phaseKind,
  roll,
  setCash,
} from './support.js';

/** p1 preso al inicio de su turno. */
function jailed(attempts = 0): GameState {
  const state = newGame();
  const p1 = state.players['p1']!;
  p1.position = 10;
  p1.inJail = true;
  p1.jailAttempts = attempts;
  state.phase = { kind: 'jailDecision' };
  return state;
}

describe('cárcel', () => {
  it('un jugador preso empieza su turno en jailDecision', () => {
    const state = roll(newGame(), 'p1', [1, 3]).state;
    state.players['p2']!.inJail = true;
    state.players['p2']!.position = 10;
    expect(act(state, 'p1', { type: 'endTurn' }).state.phase.kind).toBe('jailDecision');
  });

  it('pagar la fianza: sale y tira normal, con dobles incluidos (SPEC §15.4 #6)', () => {
    const paid = act(jailed(), 'p1', { type: 'payJailFine' });
    expect(cash(paid.state, 'p1')).toBe(1450);
    expect(paid.state.players['p1']?.inJail).toBe(false);
    expect(phaseKind(paid.state)).toBe('waitingRoll');
    expect(eventsOf(paid.events, 'leftJail')[0]?.method).toBe('fine');
    // 10 + 2 = 12 Edenor sin dueño, con dobles.
    const rolled = roll(paid.state, 'p1', [1, 1]).state;
    expect(rolled.turn.rollAgain).toBe(true);
  });

  it('no puede pagar la fianza sin plata', () => {
    expectRejected(
      setCash(jailed(), 'p1', 49),
      'p1',
      { type: 'payJailFine' },
      'INSUFFICIENT_FUNDS',
    );
  });

  it('usar la carta: sale y la carta vuelve al fondo de SU mazo (SPEC §15.4 #8)', () => {
    const state = jailed();
    state.players['p1']!.jailFreeCards = ['community.jailFree'];
    state.decks.community = state.decks.community.filter((id) => id !== 'community.jailFree');
    const { state: after, events } = act(state, 'p1', { type: 'useJailCard' });
    expect(after.players['p1']?.jailFreeCards).toEqual([]);
    expect(after.decks.community.at(-1)).toBe('community.jailFree');
    expect(after.decks.community).toHaveLength(16);
    expect(eventsOf(events, 'leftJail')[0]).toMatchObject({
      method: 'card',
      cardId: 'community.jailFree',
    });
    expect(phaseKind(after)).toBe('waitingRoll');
  });

  it('sin carta no puede usarla', () => {
    expectRejected(jailed(), 'p1', { type: 'useJailCard' }, 'NO_JAIL_CARD');
  });

  it('pagar o usar la carta solo al inicio del turno (SPEC §15.4 #9)', () => {
    const state = roll(newGame(), 'p1', [1, 3]).state;
    expectRejected(state, 'p1', { type: 'payJailFine' }, 'WRONG_PHASE');
  });

  it('dobles: sale, mueve y no vuelve a tirar', () => {
    const { state, events } = roll(jailed(), 'p1', [3, 3]); // 16 Monumento
    expect(state.players['p1']).toMatchObject({ inJail: false, position: 16 });
    expect(eventsOf(events, 'leftJail')[0]?.method).toBe('doubles');
    expect(state.phase).toEqual({ kind: 'awaitingPurchase', tile: 16 });
    const declined = act(state, 'p1', { type: 'declineProperty' }).state;
    expect(phaseKind(declined)).toBe('postRoll');
  });

  it('sin dobles en el 1.º y 2.º intento: sigue preso y pasa a postRoll', () => {
    const first = roll(jailed(), 'p1', [1, 2]);
    expect(first.state.players['p1']).toMatchObject({
      inJail: true,
      jailAttempts: 1,
      position: 10,
    });
    expect(eventsOf(first.events, 'jailRollFailed')[0]?.attempt).toBe(1);
    expect(phaseKind(first.state)).toBe('postRoll');
    const second = roll(jailed(1), 'p1', [1, 2]).state;
    expect(second.players['p1']).toMatchObject({ inJail: true, jailAttempts: 2 });
  });

  it('3.er intento fallido: paga la fianza obligatoria y mueve con esa tirada', () => {
    const { state, events } = roll(jailed(2), 'p1', [1, 3]); // 14 Mar del Plata
    expect(state.players['p1']).toMatchObject({ inJail: false, position: 14, jailAttempts: 0 });
    expect(cash(state, 'p1')).toBe(1450);
    expect(eventsOf(events, 'leftJail')[0]?.method).toBe('forcedFine');
  });

  it('maxJailTurns configurable', () => {
    const state = jailed(0);
    const rules = { ...state.rules, maxJailTurns: 1 };
    const { state: after } = roll({ ...state, rules }, 'p1', [1, 3]);
    expect(after.players['p1']?.inJail).toBe(false);
  });

  it('3.er intento sin $50: deuda con el banco y, si quiebra, no mueve (SPEC §15.4 #7)', () => {
    const { state } = roll(setCash(jailed(2), 'p1', 20), 'p1', [1, 3]);
    expect(state.phase).toMatchObject({
      kind: 'inDebt',
      debts: [{ debtorId: 'p1', creditor: 'bank', amount: 50, reason: 'jailFine' }],
      returnTo: { kind: 'moveAfterJailFine', dice: [1, 3] },
    });
    const after = act(state, 'p1', { type: 'declareBankruptcy' }).state;
    expect(after.phase).toEqual({ kind: 'gameOver', winnerId: 'p2' });
    expect(after.players['p1']?.position).toBe(10);
  });

  it('preso cobra alquiler', () => {
    const state = own(roll(newGame(), 'p1', [1, 3]).state, 6, 'p1');
    state.players['p1']!.inJail = true;
    const next = act(state, 'p1', { type: 'endTurn' }).state;
    expect(cash(roll(next, 'p2', [2, 4]).state, 'p1')).toBe(1300 + 6);
  });
});
