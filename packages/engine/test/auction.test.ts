import { describe, expect, it } from 'vitest';
import { legalActions, minBidFor } from '../src/index.js';
import { act, cash, eventsOf, expectRejected, newGame, phaseKind, roll } from './support.js';

/** p1 cae en San Telmo (3) y la rechaza: se abre la subasta entre los 3. */
function declined(players = 3) {
  const landed = roll(newGame(players), 'p1', [1, 2]).state;
  return act(landed, 'p1', { type: 'declineProperty' });
}

describe('subasta al rechazar (SPEC §5.2)', () => {
  it('se abre entre todos los activos, incluido el que rechazó', () => {
    const { state, events } = declined();
    expect(state.phase).toMatchObject({
      kind: 'auction',
      lot: { kind: 'property', tile: 3 },
      participants: ['p1', 'p2', 'p3'],
      highBid: 0,
      highBidder: null,
    });
    expect(eventsOf(events, 'auctionOpened')[0]).toMatchObject({ minBid: 10 });
  });

  it('la puja mínima arranca en auctionStartBid y después sube de a $1', () => {
    const { state } = declined();
    expect(minBidFor(state, 'p2')).toBe(10);
    expectRejected(state, 'p2', { type: 'bid', amount: 9 }, 'BID_TOO_LOW');
    const bid = act(state, 'p2', { type: 'bid', amount: 10 }).state;
    expect(minBidFor(bid, 'p3')).toBe(11);
    expectRejected(bid, 'p3', { type: 'bid', amount: 10 }, 'BID_TOO_LOW');
    expectRejected(bid, 'p3', { type: 'bid', amount: 10.5 }, 'BID_TOO_LOW');
  });

  it('no se puede pujar más que el efectivo', () => {
    const { state } = declined();
    expectRejected(state, 'p2', { type: 'bid', amount: 1501 }, 'INSUFFICIENT_FUNDS');
  });

  it('pujan todos a la vez: no hay turno dentro de la subasta', () => {
    const { state } = declined();
    for (const id of ['p1', 'p2', 'p3']) {
      expect(legalActions(state, id).map((a) => a.type)).toEqual(['passAuction', 'bid']);
    }
  });

  it('gana la puja más alta cuando los demás pasan; paga al banco', () => {
    let { state } = declined();
    state = act(state, 'p2', { type: 'bid', amount: 10 }).state;
    state = act(state, 'p3', { type: 'bid', amount: 25 }).state;
    state = act(state, 'p1', { type: 'passAuction' }).state;
    const { state: closed, events } = act(state, 'p2', { type: 'passAuction' });
    expect(closed.properties[3]).toEqual({ ownerId: 'p3', houses: 0, mortgaged: false });
    expect(cash(closed, 'p3')).toBe(1475);
    expect(eventsOf(events, 'auctionClosed')[0]).toMatchObject({ winnerId: 'p3', amount: 25 });
    // Vuelve al turno de p1, que ya tiró.
    expect(closed.currentPlayerId).toBe('p1');
    expect(phaseKind(closed)).toBe('postRoll');
  });

  it('el que va ganando no puede pasar', () => {
    const { state } = declined();
    const bid = act(state, 'p2', { type: 'bid', amount: 10 }).state;
    expectRejected(bid, 'p2', { type: 'passAuction' }, 'HIGH_BIDDER_CANNOT_PASS');
  });

  it('si todos pasan sin pujar, queda en el banco', () => {
    let { state } = declined();
    state = act(state, 'p1', { type: 'passAuction' }).state;
    state = act(state, 'p2', { type: 'passAuction' }).state;
    const { state: closed, events } = act(state, 'p3', { type: 'passAuction' });
    expect(closed.properties[3]).toBeUndefined();
    expect(eventsOf(events, 'auctionClosed')[0]).toMatchObject({ winnerId: null });
    expect(phaseKind(closed)).toBe('postRoll');
  });

  it('un solo postor: el que rechazó puede ganarla más barata (regla oficial)', () => {
    let { state } = declined(2);
    state = act(state, 'p1', { type: 'bid', amount: 10 }).state;
    const { state: closed } = act(state, 'p2', { type: 'passAuction' });
    expect(closed.properties[3]?.ownerId).toBe('p1');
    expect(cash(closed, 'p1')).toBe(1490);
  });

  it('si el último que queda puja, gana en el acto', () => {
    let { state } = declined();
    state = act(state, 'p1', { type: 'passAuction' }).state;
    state = act(state, 'p2', { type: 'passAuction' }).state;
    const { state: closed } = act(state, 'p3', { type: 'bid', amount: 10 });
    expect(closed.properties[3]?.ownerId).toBe('p3');
  });

  it('con dobles pendientes, al cerrar vuelve a waitingRoll', () => {
    const landed = roll(newGame(2), 'p1', [1, 2]).state;
    landed.turn.rollAgain = true;
    let state = act(landed, 'p1', { type: 'declineProperty' }).state;
    state = act(state, 'p1', { type: 'passAuction' }).state;
    expect(phaseKind(act(state, 'p2', { type: 'passAuction' }).state)).toBe('waitingRoll');
  });

  it('fuera de la subasta no se puede pujar', () => {
    expectRejected(newGame(), 'p1', { type: 'bid', amount: 10 }, 'WRONG_PHASE');
    const { state } = declined();
    const left = act(state, 'p1', { type: 'passAuction' }).state;
    expectRejected(left, 'p1', { type: 'bid', amount: 50 }, 'NOT_YOUR_TURN');
  });
});
