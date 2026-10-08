import { describe, expect, it } from 'vitest';
import { createCtx, playerOf } from '../src/context.js';
import { drawCard } from '../src/rules/cards.js';
import { useJailCard } from '../src/rules/jail.js';
import { transfer } from '../src/rules/money.js';
import { nearestAhead } from '../src/rules/movement.js';
import { priceOf } from '../src/rules/purchase.js';
import { rentFor } from '../src/index.js';
import { startNextTurn } from '../src/rules/turn.js';
import { act, cash, newGame, own, setCash } from './support.js';

/**
 * Contratos internos: estas guardas tiran porque llegar ahí es un bug del
 * engine (validate tendría que haberlo frenado), no una jugada inválida.
 */
describe('guardas internas', () => {
  it('playerOf con un id que no existe', () => {
    expect(() => playerOf(newGame(), 'zz')).toThrow();
  });

  it('transfer rechaza montos no enteros, negativos o sin fondos', () => {
    const ctx = createCtx(newGame());
    expect(() => {
      transfer(ctx, 'bank', 'p1', 1.5, 'card');
    }).toThrow();
    expect(() => {
      transfer(ctx, 'bank', 'p1', -1, 'card');
    }).toThrow();
    expect(() => {
      transfer(ctx, 'pot', 'p1', 1, 'pot');
    }).toThrow();
    expect(() => {
      transfer(ctx, 'p1', 'bank', 10_000, 'card');
    }).toThrow();
    transfer(ctx, 'p1', 'p1', 10, 'card');
    transfer(ctx, 'bank', 'p1', 0, 'card');
    expect(ctx.events).toEqual([]);
  });

  it('priceOf de una casilla que no se compra', () => {
    expect(() => priceOf(0)).toThrow();
    expect(priceOf(39)).toBe(400);
  });

  it('nearestAhead: estrictamente adelante, con vuelta', () => {
    expect(nearestAhead(5, [5, 15])).toBe(15);
    expect(nearestAhead(36, [5, 15, 25, 35])).toBe(5);
    expect(() => nearestAhead(0, [])).toThrow();
  });

  it('rentFor de una casilla que no se alquila es 0', () => {
    const state = newGame();
    state.properties[4] = { ownerId: 'p2', houses: 0, mortgaged: false };
    expect(rentFor(state, 4, 7)).toBe(0);
  });

  it('robar de un mazo vacío o usar una carta que no tiene', () => {
    const state = newGame();
    state.decks.chance = [];
    expect(() => {
      drawCard(createCtx(state), 'p1', 'chance');
    }).toThrow();
    expect(() => {
      useJailCard(createCtx(newGame()), 'p1');
    }).toThrow();
  });

  it('el turno salta a los quebrados', () => {
    const state = newGame(3);
    state.currentPlayerId = 'p2';
    state.players['p3']!.bankrupt = true;
    const ctx = createCtx(state);
    startNextTurn(ctx);
    expect(ctx.s.currentPlayerId).toBe('p1');
  });
});

describe('returnTo: moveAfterJailFine', () => {
  it('si el jugador del turno no quebró, sale de la cárcel y mueve con la tirada guardada', () => {
    // Estado armado a mano: en M2 solo se llega a esta rama si otro deudor
    // está antes en la cola. En M3 se llega pagando la deuda (payDebt).
    const state = setCash(newGame(3), 'p2', 0);
    const p1 = state.players['p1']!;
    p1.inJail = true;
    p1.position = 10;
    p1.jailAttempts = 3;
    state.phase = {
      kind: 'inDebt',
      debts: [{ debtorId: 'p2', creditor: 'bank', amount: 10, reason: 'card' }],
      returnTo: { kind: 'moveAfterJailFine', dice: [1, 3] },
    };
    const { state: after } = act(state, 'p2', { type: 'declareBankruptcy' });
    expect(after.players['p1']).toMatchObject({ inJail: false, position: 14 });
    expect(after.phase).toEqual({ kind: 'awaitingPurchase', tile: 14 });
  });

  it('quiebra ante el banco con edificios: vuelven al stock, nadie cobra la reventa', () => {
    const state = own(setCash(newGame(3), 'p1', 0), 1, 'p1', { houses: 3 });
    state.bank.houses = 29;
    state.phase = {
      kind: 'inDebt',
      debts: [{ debtorId: 'p1', creditor: 'bank', amount: 100, reason: 'tax' }],
      returnTo: { kind: 'finishResolution' },
    };
    const { state: after } = act(state, 'p1', { type: 'declareBankruptcy' });
    expect(after.bank.houses).toBe(32);
    expect(after.properties[1]).toBeUndefined();
    expect(cash(after, 'p2')).toBe(1500);
  });
});
