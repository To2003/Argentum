import { describe, expect, it } from 'vitest';
import { act, cash, eventsOf, expectRejected, newGame, own, phaseKind, roll } from './support.js';
import type { GameState } from '../src/index.js';

/** p1 dueño de los dos marrones (1, 3), en postRoll. */
function browns(state: GameState = newGame(3)): GameState {
  own(state, 1, 'p1');
  own(state, 3, 'p1');
  state.phase = { kind: 'postRoll' };
  return state;
}

describe('construcción (SPEC §5.4)', () => {
  it('construye una casa con el grupo completo: paga el costo y sale del stock', () => {
    const { state, events } = act(browns(), 'p1', { type: 'buildHouse', tile: 1 });
    expect(state.properties[1]?.houses).toBe(1);
    expect(state.bank.houses).toBe(31);
    expect(cash(state, 'p1')).toBe(1450);
    expect(eventsOf(events, 'buildingBuilt')[0]).toMatchObject({ tile: 1, houses: 1 });
  });

  it('sin el grupo completo, no', () => {
    const state = own(newGame(), 1, 'p1');
    state.phase = { kind: 'postRoll' };
    expectRejected(state, 'p1', { type: 'buildHouse', tile: 1 }, 'INCOMPLETE_GROUP');
  });

  it('con una propiedad del grupo hipotecada, no', () => {
    const state = browns();
    state.properties[3]!.mortgaged = true;
    expectRejected(state, 'p1', { type: 'buildHouse', tile: 1 }, 'GROUP_MORTGAGED');
  });

  it('construcción pareja: no se puede tener 2 de diferencia', () => {
    const one = act(browns(), 'p1', { type: 'buildHouse', tile: 1 }).state;
    expectRejected(one, 'p1', { type: 'buildHouse', tile: 1 }, 'UNEVEN_BUILDING');
    expect(act(one, 'p1', { type: 'buildHouse', tile: 3 }).state.properties[3]?.houses).toBe(1);
  });

  it('sin evenBuild, se puede apilar', () => {
    const state = browns(newGame(3, { evenBuild: false }));
    const one = act(state, 'p1', { type: 'buildHouse', tile: 1 }).state;
    expect(act(one, 'p1', { type: 'buildHouse', tile: 1 }).state.properties[1]?.houses).toBe(2);
  });

  it('con 4 casas, el próximo es hotel: devuelve las 4 casas al banco', () => {
    const state = browns();
    state.properties[1]!.houses = 4;
    state.properties[3]!.houses = 4;
    state.bank.houses = 24;
    const { state: after } = act(state, 'p1', { type: 'buildHouse', tile: 1 });
    expect(after.properties[1]?.houses).toBe(5);
    expect(after.bank).toEqual({ houses: 28, hotels: 11 });
  });

  it('con hotel no se construye más', () => {
    const state = browns();
    state.properties[1]!.houses = 5;
    state.properties[3]!.houses = 5;
    state.bank = { houses: 32, hotels: 10 };
    expectRejected(state, 'p1', { type: 'buildHouse', tile: 1 }, 'MAX_BUILDINGS');
  });

  it('escasez: sin casas en el banco no se puede construir', () => {
    const state = browns();
    state.bank.houses = 0;
    expectRejected(state, 'p1', { type: 'buildHouse', tile: 1 }, 'NO_BUILDINGS_LEFT');
  });

  it('sin plata no', () => {
    const state = browns();
    state.players['p1']!.cash = 49;
    expectRejected(state, 'p1', { type: 'buildHouse', tile: 1 }, 'INSUFFICIENT_FUNDS');
  });

  it('se puede construir antes de tirar y preso, no fuera de turno ni en una compra', () => {
    const before = browns();
    before.phase = { kind: 'waitingRoll' };
    expect(act(before, 'p1', { type: 'buildHouse', tile: 1 }).state.properties[1]?.houses).toBe(1);
    const jailed = browns();
    jailed.players['p1']!.inJail = true;
    jailed.phase = { kind: 'jailDecision' };
    expect(act(jailed, 'p1', { type: 'buildHouse', tile: 1 }).state.properties[1]?.houses).toBe(1);
    expectRejected(browns(), 'p2', { type: 'buildHouse', tile: 1 }, 'NOT_YOUR_TURN');
    const buying = browns();
    buying.phase = { kind: 'awaitingPurchase', tile: 6 };
    expectRejected(buying, 'p1', { type: 'buildHouse', tile: 1 }, 'WRONG_PHASE');
  });
});

describe('venta de edificios', () => {
  it('a la mitad del costo, pareja y desde la que más tiene', () => {
    let state = browns();
    state = act(state, 'p1', { type: 'buildHouse', tile: 1 }).state;
    state = act(state, 'p1', { type: 'buildHouse', tile: 3 }).state;
    state = act(state, 'p1', { type: 'buildHouse', tile: 1 }).state;
    expectRejected(state, 'p1', { type: 'sellBuilding', tile: 3 }, 'UNEVEN_BUILDING');
    const { state: sold, events } = act(state, 'p1', { type: 'sellBuilding', tile: 1 });
    expect(sold.properties[1]?.houses).toBe(1);
    expect(sold.bank.houses).toBe(30);
    expect(cash(sold, 'p1')).toBe(1500 - 150 + 25);
    expect(eventsOf(events, 'buildingSold')[0]).toMatchObject({ tile: 1, houses: 1 });
  });

  it('un hotel vuelve a 4 casas si el banco las tiene', () => {
    const state = browns();
    state.properties[1]!.houses = 5;
    state.properties[3]!.houses = 5;
    state.bank = { houses: 32, hotels: 10 };
    const sold = act(state, 'p1', { type: 'sellBuilding', tile: 1 }).state;
    expect(sold.properties[1]?.houses).toBe(4);
    expect(sold.bank).toEqual({ houses: 28, hotels: 11 });
  });

  it('si el banco no tiene 4 casas, el hotel no se puede desarmar de a uno: sellAllBuildings', () => {
    const state = browns();
    state.properties[1]!.houses = 5;
    state.properties[3]!.houses = 5;
    state.bank = { houses: 2, hotels: 10 };
    expectRejected(state, 'p1', { type: 'sellBuilding', tile: 1 }, 'NO_BUILDINGS_LEFT');
    const { state: sold } = act(state, 'p1', { type: 'sellAllBuildings', group: 'brown' });
    expect(sold.properties[1]?.houses).toBe(0);
    expect(sold.properties[3]?.houses).toBe(0);
    expect(sold.bank).toEqual({ houses: 2, hotels: 12 });
    // 2 hoteles = 10 edificios × $50 / 2
    expect(cash(sold, 'p1')).toBe(1500 + 250);
  });

  it('sellAllBuildings sin edificios o de un grupo ajeno, no', () => {
    expectRejected(browns(), 'p1', { type: 'sellAllBuildings', group: 'brown' }, 'MAX_BUILDINGS');
    expectRejected(browns(), 'p1', { type: 'sellAllBuildings', group: 'green' }, 'NOT_OWNER');
  });
});

describe('subasta de la última casa (escasez, SPEC §5.4)', () => {
  /** p1 marrones, p2 celestes; queda 1 casa en el banco. */
  function scarce(): GameState {
    const state = browns();
    for (const tile of [6, 8, 9]) own(state, tile, 'p2');
    state.bank.houses = 1;
    // Para que las 31 casas existan en algún lado (invariante 32/12).
    return state;
  }

  it('si otro también podría construir, se subasta entre los interesados', () => {
    const { state, events } = act(scarce(), 'p1', { type: 'buildHouse', tile: 1 });
    expect(state.phase).toMatchObject({
      kind: 'auction',
      lot: { kind: 'building', building: 'house', initiator: 'p1', tile: 1 },
      participants: ['p1', 'p2'],
    });
    expect(eventsOf(events, 'buildingBuilt')).toHaveLength(0);
  });

  it('la puja mínima es el costo de casa del grupo de cada uno', () => {
    const { state } = act(scarce(), 'p1', { type: 'buildHouse', tile: 1 });
    expectRejected(state, 'p1', { type: 'bid', amount: 49 }, 'BID_TOO_LOW');
    expect(act(state, 'p2', { type: 'bid', amount: 50 }).state.phase).toMatchObject({
      highBid: 50,
    });
  });

  it('si gana otro, la casa va a su primera propiedad válida y vuelve la fase del que construía', () => {
    let { state } = act(scarce(), 'p1', { type: 'buildHouse', tile: 1 });
    state = act(state, 'p2', { type: 'bid', amount: 70 }).state;
    const { state: closed } = act(state, 'p1', { type: 'passAuction' });
    expect(closed.properties[6]?.houses).toBe(1);
    expect(closed.properties[1]?.houses).toBe(0);
    expect(closed.bank.houses).toBe(0);
    expect(cash(closed, 'p2')).toBe(1430);
    expect(phaseKind(closed)).toBe('postRoll');
    expect(closed.currentPlayerId).toBe('p1');
  });

  it('si gana el que la pidió, va donde la pidió', () => {
    let { state } = act(scarce(), 'p1', { type: 'buildHouse', tile: 1 });
    state = act(state, 'p1', { type: 'bid', amount: 60 }).state;
    const { state: closed } = act(state, 'p2', { type: 'passAuction' });
    expect(closed.properties[1]?.houses).toBe(1);
    expect(cash(closed, 'p1')).toBe(1440);
  });

  it('sin otros interesados, se construye normal', () => {
    const state = browns();
    state.bank.houses = 1;
    const { state: after } = act(state, 'p1', { type: 'buildHouse', tile: 1 });
    expect(after.properties[1]?.houses).toBe(1);
    expect(phaseKind(after)).toBe('postRoll');
  });

  it('el último hotel también', () => {
    const state = scarce();
    state.bank = { houses: 20, hotels: 1 };
    for (const tile of [1, 3]) state.properties[tile]!.houses = 4;
    for (const tile of [6, 8, 9]) state.properties[tile]!.houses = 4;
    const { state: after } = act(state, 'p1', { type: 'buildHouse', tile: 1 });
    expect(after.phase).toMatchObject({ kind: 'auction', lot: { building: 'hotel' } });
  });
});

it('después de construir sigue en la misma fase', () => {
  const before = browns();
  before.phase = { kind: 'waitingRoll' };
  const built = act(before, 'p1', { type: 'buildHouse', tile: 1 }).state;
  expect(phaseKind(built)).toBe('waitingRoll');
  expect(phaseKind(roll(built, 'p1', [2, 3]).state)).not.toBe('waitingRoll');
});

it('un rival sin plata para el precio de lista no entra a la subasta de la última casa', () => {
  const state = own(own(newGame(3), 1, 'p1'), 3, 'p1');
  for (const tile of [6, 8, 9]) own(state, tile, 'p2');
  state.players['p2']!.cash = 49;
  state.bank.houses = 1;
  state.phase = { kind: 'postRoll' };
  const { state: after } = act(state, 'p1', { type: 'buildHouse', tile: 1 });
  expect(after.properties[1]?.houses).toBe(1);
  expect(after.phase.kind).toBe('postRoll');
});
