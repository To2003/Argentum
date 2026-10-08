import { DECKS, type DeckKind } from '@gran-negocio/shared';
import { describe, expect, it } from 'vitest';
import { MAX_RESOLUTION_DEPTH, type GameState } from '../src/index.js';
import {
  act,
  cash,
  eventsOf,
  expectRejected,
  newGame,
  own,
  phaseKind,
  place,
  roll,
  setCash,
  topCard,
} from './support.js';

/** Lleva a p1 a la casilla de carta `tile` con un 1+2 y la carta `cardId` arriba. */
function drawAt(state: GameState, tile: number, cardId: string, ...extraDice: [number, number][]) {
  const deck: DeckKind = cardId.startsWith('chance.') ? 'chance' : 'community';
  topCard(state, deck, cardId);
  place(state, 'p1', (tile - 3 + 40) % 40);
  return roll(state, 'p1', [1, 2], ...extraDice);
}

const CHANCE_TILES = [7, 22, 36] as const;
const COMMUNITY_TILES = [2, 17, 33] as const;

/** [carta, destino desde 7, 22, 36, pasa por la Salida desde 7, 22, 36] */
const CHANCE_MOVES: readonly (readonly [string, readonly number[], readonly boolean[]])[] = [
  ['chance.advanceToGo', [0, 0, 0], [true, true, true]],
  ['chance.advanceToAltaGracia', [24, 24, 24], [false, false, true]],
  ['chance.advanceToTigre', [11, 11, 11], [false, true, true]],
  ['chance.advanceToPuertoMadero', [39, 39, 39], [false, false, false]],
  ['chance.nearestUtility', [12, 28, 12], [false, false, true]],
  ['chance.nearestSubway1', [15, 25, 5], [false, false, true]],
  ['chance.nearestSubway2', [15, 25, 5], [false, false, true]],
  ['chance.goBack3', [4, 19, 33], [false, false, false]],
  // "Línea A" desde la 7 pasa por la Salida: 5 < 7.
  ['chance.rideLineA', [5, 5, 5], [true, true, true]],
];

describe('cartas de movimiento desde cada casilla', () => {
  for (const [cardId, targets, passes] of CHANCE_MOVES) {
    CHANCE_TILES.forEach((tile, i) => {
      it(`${cardId} desde la ${tile} → ${targets[i]}${passes[i] ? ' (cobra Salida)' : ''}`, () => {
        const state = newGame();
        // Barrio de la 33 (Retrocedé 3 desde la 36) con una carta sin efecto de movimiento.
        topCard(state, 'community', 'community.taxRefund');
        const { events } = drawAt(state, tile, cardId);
        const cardMove = eventsOf(events, 'moved').find((e) => e.cause === 'card');
        expect(cardMove).toMatchObject({ from: tile, to: targets[i], passedGo: passes[i] });
        const salaries = eventsOf(events, 'moneyTransferred').filter((e) => e.reason === 'salary');
        expect(salaries).toHaveLength(passes[i] ? 1 : 0);
      });
    });
  }

  COMMUNITY_TILES.forEach((tile) => {
    it(`community.advanceToGo desde la ${tile} → 0 y cobra una vez`, () => {
      const { events, state } = drawAt(newGame(), tile, 'community.advanceToGo');
      expect(state.players['p1']?.position).toBe(0);
      const cardMove = eventsOf(events, 'moved').find((e) => e.cause === 'card');
      expect(cardMove).toMatchObject({ from: tile, to: 0, passedGo: true });
      // Desde la 2 los dados (39 → 2) ya pasaron por la Salida: dos cobros, uno por movimiento.
      const salaries = eventsOf(events, 'moneyTransferred').filter((e) => e.reason === 'salary');
      expect(salaries).toHaveLength(tile === 2 ? 2 : 1);
    });
  });
});

describe('encadenado de casillas', () => {
  it('Retrocedé 3 desde la 36 cae en Barrio (33) y roba ahí', () => {
    const state = newGame();
    topCard(state, 'community', 'community.inheritance');
    const { events } = drawAt(state, 36, 'chance.goBack3');
    expect(eventsOf(events, 'cardDrawn').map((e) => e.cardId)).toEqual([
      'chance.goBack3',
      'community.inheritance',
    ]);
  });

  it('Retrocedé 3 desde la 7 cae en Ganancias y paga', () => {
    const { state } = drawAt(newGame(), 7, 'chance.goBack3');
    expect(cash(state, 'p1')).toBe(1300);
  });

  it('hay una guarda de profundidad', () => {
    expect(MAX_RESOLUTION_DEPTH).toBeGreaterThanOrEqual(2);
  });
});

describe('cartas de plata', () => {
  const MONEY: readonly (readonly [string, number])[] = [
    ['chance.aguinaldo', 50],
    ['chance.parkingFine', -15],
    ['chance.plazoFijo', 150],
    ['community.bankError', 200],
    ['community.prepaga', -50],
    ['community.savedDollars', 50],
    ['community.savingsPlan', 100],
    ['community.taxRefund', 20],
    ['community.lifeInsurance', 100],
    ['community.hospital', -100],
    ['community.schoolFees', -50],
    ['community.consulting', 25],
    ['community.empanadaContest', 10],
    ['community.inheritance', 100],
  ];

  it.each(MONEY)('%s: %i', (cardId, delta) => {
    const tile = cardId.startsWith('chance.') ? 7 : 17;
    const { state } = drawAt(newGame(), tile, cardId);
    expect(cash(state, 'p1')).toBe(1500 + delta);
    expect(phaseKind(state)).toBe('postRoll');
  });

  it('con freeParkingPot, las multas de carta van al pozo', () => {
    const { state } = drawAt(newGame(2, { freeParkingPot: true }), 7, 'chance.parkingFine');
    expect(state.pot).toBe(15);
  });

  it('cumpleaños: cada jugador le da $10', () => {
    const { state } = drawAt(newGame(3), 17, 'community.birthday');
    expect([cash(state, 'p1'), cash(state, 'p2'), cash(state, 'p3')]).toEqual([1520, 1490, 1490]);
  });

  it('presidente del consorcio: paga $50 a cada jugador', () => {
    const { state } = drawAt(newGame(3), 7, 'chance.consorcioPresident');
    expect([cash(state, 'p1'), cash(state, 'p2'), cash(state, 'p3')]).toEqual([1400, 1550, 1550]);
  });

  it('arreglos: $25 por casa y $100 por hotel (Suerte), $40 y $115 (Barrio)', () => {
    const build = (state: GameState) =>
      own(own(state, 1, 'p1', { houses: 2 }), 3, 'p1', { houses: 5 });
    expect(cash(drawAt(build(newGame()), 7, 'chance.consorcioRepairs').state, 'p1')).toBe(
      1500 - 150,
    );
    expect(cash(drawAt(build(newGame()), 17, 'community.streetRepairs').state, 'p1')).toBe(
      1500 - 195,
    );
  });

  it('arreglos sin edificios no cobran nada', () => {
    const { events } = drawAt(newGame(), 7, 'chance.consorcioRepairs');
    expect(eventsOf(events, 'moneyTransferred')).toHaveLength(0);
  });
});

describe('cartas de cárcel', () => {
  it.each([
    ['chance.goToJail', 7],
    ['community.goToJail', 17],
  ] as const)('%s manda preso sin cobrar la Salida', (cardId, tile) => {
    const { state, events } = drawAt(newGame(), tile, cardId);
    expect(state.players['p1']).toMatchObject({ position: 10, inJail: true });
    expect(eventsOf(events, 'sentToJail')[0]?.cause).toBe('card');
    expect(phaseKind(state)).toBe('postRoll');
  });

  it('"Salí gratis" queda en la mano y no vuelve al mazo', () => {
    const { state, events } = drawAt(newGame(), 7, 'chance.jailFree');
    expect(state.players['p1']?.jailFreeCards).toEqual(['chance.jailFree']);
    expect(state.decks.chance).toHaveLength(15);
    expect(state.decks.chance).not.toContain('chance.jailFree');
    expect(eventsOf(events, 'jailFreeCardKept')).toHaveLength(1);
  });

  it('las demás cartas vuelven al fondo del mazo', () => {
    const { state } = drawAt(newGame(), 7, 'chance.aguinaldo');
    expect(state.decks.chance.at(-1)).toBe('chance.aguinaldo');
    expect(state.decks.chance).toHaveLength(16);
  });
});

describe('cartas "más cercano"', () => {
  it('servicio sin dueño: se puede comprar', () => {
    const { state } = drawAt(newGame(), 7, 'chance.nearestUtility');
    expect(state.phase).toEqual({ kind: 'awaitingPurchase', tile: 12 });
  });

  it('servicio con dueño: vuelve a tirar, paga 10× y esa tirada no cuenta como dobles', () => {
    const state = own(newGame(), 12, 'p2');
    const { state: after, events } = drawAt(state, 7, 'chance.nearestUtility', [4, 4]);
    const rolls = eventsOf(events, 'diceRolled');
    expect(rolls.map((e) => e.reason)).toEqual(['move', 'utilityCard']);
    expect(rolls[1]?.dice).toEqual([4, 4]);
    expect(cash(after, 'p1')).toBe(1500 - 80);
    expect(after.turn).toMatchObject({ doublesCount: 0, rollAgain: false });
    expect(phaseKind(after)).toBe('postRoll');
  });

  it('subte con dueño: paga el doble del alquiler que corresponde', () => {
    const state = own(own(newGame(), 15, 'p2'), 25, 'p2');
    const { state: after } = drawAt(state, 7, 'chance.nearestSubway1');
    expect(cash(after, 'p1')).toBe(1500 - 100);
    expect(cash(after, 'p2')).toBe(1600);
  });

  it('subte hipotecado: no paga', () => {
    const state = own(newGame(), 15, 'p2', { mortgaged: true });
    expect(cash(drawAt(state, 7, 'chance.nearestSubway2').state, 'p1')).toBe(1500);
  });
});

describe('cartas que no se pueden pagar', () => {
  it('presidente del consorcio sin plata: paga a quien llega y debe al resto, en orden de turno', () => {
    const state = setCash(newGame(3), 'p1', 60);
    const { state: after } = drawAt(state, 7, 'chance.consorcioPresident');
    expect(cash(after, 'p2')).toBe(1550);
    expect(after.phase).toMatchObject({
      kind: 'inDebt',
      debts: [{ debtorId: 'p1', creditor: 'p3', amount: 50 }],
    });
  });

  it('cumpleaños: el que no puede pagar queda en deuda y actúa él, no el del turno', () => {
    const state = setCash(setCash(newGame(4), 'p3', 5), 'p2', 3);
    const { state: after } = drawAt(state, 17, 'community.birthday');
    // Cola en orden de turno empezando por el siguiente al del turno: p2, luego p3.
    expect(after.phase).toMatchObject({
      kind: 'inDebt',
      debts: [
        { debtorId: 'p2', creditor: 'p1', amount: 10 },
        { debtorId: 'p3', creditor: 'p1', amount: 10 },
      ],
    });
    expect(cash(after, 'p1')).toBe(1510);
    expectRejected(after, 'p1', { type: 'endTurn' }, 'NOT_YOUR_TURN');
    expectRejected(after, 'p3', { type: 'declareBankruptcy' }, 'NOT_YOUR_TURN');
    const next = act(after, 'p2', { type: 'declareBankruptcy' }).state;
    expect(next.phase).toMatchObject({ kind: 'inDebt', debts: [{ debtorId: 'p3' }] });
    const done = act(next, 'p3', { type: 'declareBankruptcy' }).state;
    expect(done.phase.kind).toBe('postRoll');
    expect(done.currentPlayerId).toBe('p1');
  });
});

it('los dos mazos son los 16 + 16 de shared', () => {
  const state = newGame();
  expect([...state.decks.chance].sort()).toEqual(DECKS.chance.map((c) => c.id).sort());
  expect([...state.decks.community].sort()).toEqual(DECKS.community.map((c) => c.id).sort());
});
