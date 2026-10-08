import { describe, expect, it } from 'vitest';
import { autopilotAction, type GameState } from '../src/index.js';
import { act, newGame, own, roll } from './support.js';
import { randomPlay } from './invariants.js';
import { DEFAULT_RULES } from '@gran-negocio/shared';

describe('piloto automático (SPEC §8)', () => {
  it('tira, termina el turno y nunca compra en un timeout', () => {
    const state = newGame();
    expect(autopilotAction(state, 'p1', 'timeout')).toEqual({ type: 'rollDice' });
    expect(autopilotAction(state, 'p2', 'timeout')).toBeNull();
    const landed = roll(state, 'p1', [1, 2]).state;
    expect(autopilotAction(landed, 'p1', 'timeout')).toEqual({ type: 'declineProperty' });
    const post = roll(newGame(), 'p1', [1, 3]).state;
    expect(autopilotAction(post, 'p1', 'timeout')).toEqual({ type: 'endTurn' });
  });

  it('desconectado: compra solo si le sobran $500', () => {
    const landed = roll(newGame(), 'p1', [1, 2]).state; // San Telmo $60
    expect(autopilotAction(landed, 'p1', 'disconnected')).toEqual({ type: 'buyProperty' });
    landed.players['p1']!.cash = 559;
    expect(autopilotAction(landed, 'p1', 'disconnected')).toEqual({ type: 'declineProperty' });
  });

  it('en una subasta pasa (si no va ganando)', () => {
    const landed = roll(newGame(), 'p1', [1, 2]).state;
    const auction = act(landed, 'p1', { type: 'declineProperty' }).state;
    expect(autopilotAction(auction, 'p2', 'timeout')).toEqual({ type: 'passAuction' });
    const bid = act(auction, 'p2', { type: 'bid', amount: 10 }).state;
    expect(autopilotAction(bid, 'p2', 'timeout')).toBeNull();
  });

  it('rechaza los trueques que le proponen', () => {
    const state = newGame();
    state.phase = { kind: 'postRoll' };
    const proposed = act(state, 'p1', {
      type: 'proposeTrade',
      to: 'p2',
      offer: { cash: 1, properties: [], jailFreeCards: [] },
      request: { cash: 0, properties: [], jailFreeCards: [] },
    }).state;
    expect(autopilotAction(proposed, 'p2', 'timeout')).toEqual({ type: 'rejectTrade' });
  });

  it('en una deuda crítica vende, hipoteca y paga; si no alcanza, quiebra', () => {
    const indebted = (state: GameState): GameState => {
      state.phase = {
        kind: 'inDebt',
        debts: [{ debtorId: 'p1', creditor: 'bank', amount: 200, reason: 'tax' }],
        returnTo: { kind: 'finishResolution' },
      };
      state.players['p1']!.cash = 0;
      return state;
    };
    const withHouses = indebted(
      own(own(newGame(), 1, 'p1', { houses: 1 }), 3, 'p1', { houses: 1 }),
    );
    withHouses.bank.houses = 30;
    expect(autopilotAction(withHouses, 'p1', 'timeout')?.type).toBe('sellBuilding');
    const withProperty = indebted(own(newGame(), 39, 'p1'));
    expect(autopilotAction(withProperty, 'p1', 'timeout')).toEqual({ type: 'mortgage', tile: 39 });
    const broke = indebted(newGame());
    expect(autopilotAction(broke, 'p1', 'timeout')).toEqual({ type: 'declareBankruptcy' });
    broke.players['p1']!.cash = 300;
    expect(autopilotAction(broke, 'p1', 'timeout')).toEqual({ type: 'payDebt' });
  });

  it('con la partida terminada no hace nada', () => {
    const state = newGame();
    state.phase = { kind: 'gameOver', winnerId: 'p1', reason: 'lastStanding' };
    expect(autopilotAction(state, 'p1', 'timeout')).toBeNull();
  });

  it('cuatro pilotos automáticos terminan una partida sin trabarse', () => {
    // El fuzz garantiza que siempre hay alguien con algo legal; acá, que el
    // piloto siempre elige algo legal y la partida avanza.
    const { state } = randomPlay(
      {
        seed: '00000000000000000000000000000abc',
        rules: { ...DEFAULT_RULES, maxRounds: 30 },
        players: ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, tokenId: id })),
      },
      { steps: 0, policySeed: '0'.repeat(32) },
    );
    let current = state;
    for (let i = 0; i < 5000 && current.phase.kind !== 'gameOver'; i += 1) {
      const actor = ['a', 'b', 'c', 'd'].find(
        (id) => autopilotAction(current, id, 'disconnected') !== null,
      );
      if (actor === undefined) throw new Error('nadie puede actuar');
      const action = autopilotAction(current, actor, 'disconnected');
      if (action === null) throw new Error('sin acción');
      current = act(current, actor, action).state;
    }
    expect(current.phase.kind).toBe('gameOver');
  });
});
