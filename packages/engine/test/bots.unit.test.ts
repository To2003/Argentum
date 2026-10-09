import { describe, expect, it } from 'vitest';
import { botAction, newBotMemory, valuation, type GameState } from '../src/index.js';
import { act, newGame, own, roll } from './support.js';

const postRoll = (state: GameState = newGame(3)): GameState => {
  state.phase = { kind: 'postRoll' };
  return state;
};

describe('valuación de los bots', () => {
  it('el fácil valúa al precio; completar un grupo multiplica para medio y difícil', () => {
    const state = own(newGame(), 1, 'p1');
    expect(valuation(state, 'p1', 3, 'easy')).toBe(60);
    expect(valuation(state, 'p1', 3, 'medium')).toBe(96);
    expect(valuation(state, 'p1', 3, 'hard')).toBeGreaterThan(96);
    expect(valuation(state, 'p1', 0, 'hard')).toBe(0);
  });

  it('tener parte del grupo suma; el difícil valora bloquear el grupo de otro', () => {
    const state = own(newGame(), 6, 'p1');
    expect(valuation(state, 'p1', 8, 'medium')).toBe(125);
    const blocked = own(own(newGame(), 6, 'p2'), 8, 'p2');
    expect(valuation(blocked, 'p1', 9, 'hard')).toBeGreaterThan(
      valuation(blocked, 'p1', 9, 'medium'),
    );
    // Subtes: tener otro subte suma.
    expect(valuation(own(newGame(), 5, 'p1'), 'p1', 15, 'medium')).toBe(250);
  });
});

describe('decisiones de los bots', () => {
  it('no juega si no le toca; con la partida terminada, nada', () => {
    const state = newGame();
    expect(botAction(state, 'p2', 'hard', newBotMemory())).toBeNull();
    state.phase = { kind: 'gameOver', winnerId: 'p1', reason: 'lastStanding' };
    expect(botAction(state, 'p1', 'hard', newBotMemory())).toBeNull();
  });

  it('compra: el fácil compra todo; el medio respeta su reserva salvo que complete un grupo', () => {
    const landed = roll(newGame(), 'p1', [1, 2]).state; // San Telmo $60
    expect(botAction(landed, 'p1', 'easy', newBotMemory())).toEqual({ type: 'buyProperty' });
    landed.players['p1']!.cash = 100;
    expect(botAction(landed, 'p1', 'medium', newBotMemory())).toEqual({ type: 'declineProperty' });
    own(landed, 1, 'p1');
    expect(botAction(landed, 'p1', 'medium', newBotMemory())).toEqual({ type: 'buyProperty' });
  });

  it('para una propiedad clave que no alcanza, hipoteca algo suelto', () => {
    const state = own(own(newGame(), 1, 'p1'), 39, 'p1');
    state.players['p1']!.cash = 10;
    state.phase = { kind: 'awaitingPurchase', tile: 3 };
    expect(botAction(state, 'p1', 'hard', newBotMemory())).toEqual({ type: 'mortgage', tile: 39 });
    expect(botAction(state, 'p1', 'easy', newBotMemory())).toEqual({ type: 'declineProperty' });
  });

  it('subasta: puja si vale la pena y le alcanza; si no, pasa; el que va ganando espera', () => {
    const landed = roll(newGame(3), 'p1', [1, 2]).state;
    const auction = act(landed, 'p1', { type: 'declineProperty' }).state;
    expect(botAction(auction, 'p2', 'medium', newBotMemory())).toEqual({ type: 'bid', amount: 10 });
    const bid = act(auction, 'p2', { type: 'bid', amount: 59 }).state;
    expect(botAction(bid, 'p2', 'medium', newBotMemory())).toBeNull();
    // El fácil puja hasta la mitad del precio: a $60 ya no.
    expect(botAction(bid, 'p1', 'easy', newBotMemory())).toEqual({ type: 'passAuction' });
    bid.players['p3']!.cash = 0;
    expect(botAction(bid, 'p3', 'hard', newBotMemory())).toEqual({ type: 'passAuction' });
  });

  it('subasta de la última casa: valúa el edificio', () => {
    const state = own(own(newGame(3), 1, 'p1'), 3, 'p1');
    for (const tile of [6, 8, 9]) own(state, tile, 'p2');
    state.phase = {
      kind: 'auction',
      lot: { kind: 'building', building: 'house', initiator: 'p1', tile: 1 },
      participants: ['p1', 'p2'],
      highBid: 0,
      highBidder: null,
      queue: [],
      returnTo: { kind: 'finishResolution' },
    };
    expect(botAction(state, 'p2', 'hard', newBotMemory())).toEqual({ type: 'bid', amount: 50 });
    expect(botAction(state, 'p2', 'easy', newBotMemory())).toEqual({ type: 'passAuction' });
  });

  it('deuda: paga si puede, si no vende, hipoteca lo menos útil y al final quiebra', () => {
    const indebted = (state: GameState, cash = 0) => {
      state.players['p1']!.cash = cash;
      state.phase = {
        kind: 'inDebt',
        debts: [{ debtorId: 'p1', creditor: 'bank', amount: 100, reason: 'tax' }],
        returnTo: { kind: 'finishResolution' },
      };
      return state;
    };
    expect(botAction(indebted(newGame(), 200), 'p1', 'hard', newBotMemory())).toEqual({
      type: 'payDebt',
    });
    const built = indebted(own(own(newGame(), 1, 'p1', { houses: 1 }), 3, 'p1', { houses: 1 }));
    built.bank.houses = 30;
    expect(botAction(built, 'p1', 'medium', newBotMemory())?.type).toBe('sellBuilding');
    // Hipoteca primero lo que no completa un grupo, y lo más barato.
    const props = indebted(own(own(own(newGame(), 39, 'p1'), 6, 'p1'), 1, 'p1'));
    expect(botAction(props, 'p1', 'medium', newBotMemory())).toEqual({ type: 'mortgage', tile: 1 });
    expect(botAction(indebted(newGame()), 'p1', 'easy', newBotMemory())).toEqual({
      type: 'declareBankruptcy',
    });
  });

  it('cárcel: temprano sale (carta o fianza); tarde se queda; el fácil paga si tiene plata', () => {
    const jailed = (state: GameState) => {
      state.players['p1']!.inJail = true;
      state.players['p1']!.position = 10;
      state.phase = { kind: 'jailDecision' };
      return state;
    };
    expect(botAction(jailed(newGame()), 'p1', 'medium', newBotMemory())).toEqual({
      type: 'payJailFine',
    });
    const withCard = jailed(newGame());
    withCard.players['p1']!.jailFreeCards = ['chance.jailFree'];
    expect(botAction(withCard, 'p1', 'hard', newBotMemory())).toEqual({ type: 'useJailCard' });
    // Tarde: casi todo tiene dueño.
    const late = jailed(newGame());
    for (const tile of [
      1, 3, 5, 6, 8, 9, 11, 12, 13, 14, 15, 16, 18, 19, 21, 23, 24, 25, 26, 27, 28, 29,
    ])
      own(late, tile, 'p2');
    expect(botAction(late, 'p1', 'hard', newBotMemory())).toEqual({ type: 'rollDice' });
    expect(botAction(jailed(newGame()), 'p1', 'easy', newBotMemory())).toEqual({
      type: 'payJailFine',
    });
    const poor = jailed(newGame());
    poor.players['p1']!.cash = 100;
    expect(botAction(poor, 'p1', 'easy', newBotMemory())).toEqual({ type: 'rollDice' });
  });

  it('construye con reserva: el fácil no, el difícil empieza por naranjas', () => {
    const state = postRoll(own(own(newGame(3), 1, 'p1'), 3, 'p1'));
    for (const tile of [16, 18, 19]) own(state, tile, 'p1');
    expect(botAction(state, 'p1', 'easy', newBotMemory())).toEqual({ type: 'endTurn' });
    expect(botAction(state, 'p1', 'hard', newBotMemory())).toEqual({
      type: 'buildHouse',
      tile: 16,
    });
    expect(botAction(state, 'p1', 'medium', newBotMemory())).toEqual({
      type: 'buildHouse',
      tile: 1,
    });
    state.players['p1']!.cash = 120;
    expect(botAction(state, 'p1', 'medium', newBotMemory())).toEqual({ type: 'endTurn' });
  });

  it('levanta hipotecas con plata de sobra', () => {
    const state = postRoll(own(newGame(3), 39, 'p1', { mortgaged: true }));
    expect(botAction(state, 'p1', 'medium', newBotMemory())).toEqual({
      type: 'unmortgage',
      tile: 39,
    });
    expect(botAction(state, 'p1', 'easy', newBotMemory())).toEqual({ type: 'endTurn' });
  });

  it('el difícil propone un trueque por la que le falta, una vez por turno', () => {
    const state = postRoll(own(own(own(newGame(3), 16, 'p1'), 18, 'p1'), 19, 'p2'));
    const memory = newBotMemory();
    expect(botAction(state, 'p1', 'hard', memory)).toEqual({
      type: 'proposeTrade',
      to: 'p2',
      offer: { cash: 320, properties: [], jailFreeCards: [] },
      request: { cash: 0, properties: [19], jailFreeCards: [] },
    });
    // Ya propuso este turno: ahora termina.
    expect(botAction(state, 'p1', 'hard', memory)).toEqual({ type: 'endTurn' });
    expect(botAction(state, 'p1', 'medium', newBotMemory())).toEqual({ type: 'endTurn' });
    // Sin plata para ofrecer al menos el precio, no propone.
    state.players['p1']!.cash = 150;
    expect(botAction(state, 'p1', 'hard', newBotMemory())).toEqual({ type: 'endTurn' });
  });

  it('responde trueques: el fácil rechaza; el medio acepta si gana; nadie regala un grupo', () => {
    const base = postRoll(own(newGame(3), 19, 'p2'));
    const offer = (cash: number) => {
      const state = structuredClone(base);
      state.trade = {
        id: 1,
        from: 'p1',
        to: 'p2',
        offer: { cash, properties: [], jailFreeCards: [] },
        request: { cash: 0, properties: [19], jailFreeCards: [] },
      };
      return state;
    };
    expect(botAction(offer(1000), 'p2', 'easy', newBotMemory())).toEqual({ type: 'rejectTrade' });
    expect(botAction(offer(1000), 'p2', 'medium', newBotMemory())).toEqual({ type: 'acceptTrade' });
    expect(botAction(offer(210), 'p2', 'medium', newBotMemory())).toEqual({ type: 'rejectTrade' });
    // Para el difícil los naranjas valen más (retorno ×1,3): $210 no alcanza, $300 sí.
    expect(botAction(offer(210), 'p2', 'hard', newBotMemory())).toEqual({ type: 'rejectTrade' });
    expect(botAction(offer(300), 'p2', 'hard', newBotMemory())).toEqual({ type: 'acceptTrade' });
    // Si con eso p1 completa los naranjas y p2 no gana ningún grupo, no.
    const monopoly = offer(5000);
    own(own(monopoly, 16, 'p1'), 18, 'p1');
    monopoly.players['p1']!.cash = 6000;
    expect(botAction(monopoly, 'p2', 'hard', newBotMemory())).toEqual({ type: 'rejectTrade' });
    // Un trueque que ya no vale (p1 no tiene la plata): rechaza.
    const broke = offer(1000);
    broke.players['p1']!.cash = 0;
    expect(botAction(broke, 'p2', 'hard', newBotMemory())).toEqual({ type: 'rejectTrade' });
  });
});

describe('trueques con hipotecadas y subtes', () => {
  it('una hipotecada vale la mitad para el que la recibe; los subtes no completan grupos de color', () => {
    const state = postRoll(own(own(newGame(3), 19, 'p2', { mortgaged: true }), 5, 'p2'));
    state.trade = {
      id: 1,
      from: 'p1',
      to: 'p2',
      offer: { cash: 300, properties: [], jailFreeCards: [] },
      request: { cash: 0, properties: [19, 5], jailFreeCards: [] },
    };
    // p2 da Iguazú (hipotecada) y un subte por $300: para el medio, poco.
    expect(botAction(state, 'p2', 'medium', newBotMemory())).toEqual({ type: 'rejectTrade' });
    state.trade = { ...state.trade, offer: { cash: 900, properties: [], jailFreeCards: [] } };
    expect(botAction(state, 'p2', 'medium', newBotMemory())).toEqual({ type: 'acceptTrade' });
  });
});
