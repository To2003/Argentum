import { applyAction, createGame, toPlayerView, type GameEvent } from '@gran-negocio/engine';
import { DEFAULT_RULES, createTranslator } from '@gran-negocio/shared';
import { describe, expect, it } from 'vitest';
import { eventText } from '../src/game/eventText.js';

const i18n = createTranslator('es-AR');
const plain = (text: string | null) => text?.replace(/\u00a0/g, ' ') ?? null;

const game = createGame({
  seed: '0123456789abcdef0123456789abcdef',
  rules: DEFAULT_RULES,
  players: [
    { id: 'p1', name: 'Ana', tokenId: 'mate' },
    { id: 'p2', name: 'Beto', tokenId: 'bombo' },
  ],
});
const view = toPlayerView(game.state, 'p1');
const say = (event: GameEvent) => plain(eventText(event, view, i18n));

describe('texto de los eventos (registro)', () => {
  it('dados, movimiento y compras con nombres y montos', () => {
    expect(say({ type: 'diceRolled', playerId: 'p1', dice: [3, 4], reason: 'move' })).toBe(
      'Ana sacó 3 y 4',
    );
    expect(say({ type: 'diceRolled', playerId: 'p1', dice: [2, 2], reason: 'move' })).toBe(
      'Ana sacó dobles: 2 y 2',
    );
    expect(
      say({
        type: 'moved',
        playerId: 'p2',
        from: 0,
        to: 39,
        steps: 39,
        passedGo: false,
        cause: 'dice',
      }),
    ).toBe('Beto fue a Puerto Madero');
    expect(say({ type: 'propertyBought', playerId: 'p1', tile: 1 })).toBe(
      'Ana compró Caminito por $ 60',
    );
  });

  it('plata: alquiler, salario y pagos al banco', () => {
    expect(
      say({ type: 'moneyTransferred', from: 'p2', to: 'p1', amount: 50, reason: 'rent', tile: 3 }),
    ).toBe('Beto le pagó $ 50 de alquiler a Ana');
    expect(
      say({ type: 'moneyTransferred', from: 'bank', to: 'p1', amount: 200, reason: 'salary' }),
    ).toBe('Ana pasó por la Salida y cobró $ 200');
    expect(
      say({ type: 'moneyTransferred', from: 'p1', to: 'bank', amount: 200, reason: 'tax' }),
    ).toBe('Ana pagó $ 200');
    expect(
      say({ type: 'moneyTransferred', from: 'p1', to: 'bank', amount: 60, reason: 'purchase' }),
    ).toBeNull();
  });

  it('cartas con su texto completo', () => {
    expect(
      say({ type: 'cardDrawn', playerId: 'p1', deck: 'community', cardId: 'community.birthday' }),
    ).toBe('Ana sacó una carta de Barrio: “Es tu cumpleaños: cada jugador te da $ 10.”');
  });

  it('subastas y fin de partida', () => {
    expect(
      say({
        type: 'auctionClosed',
        lot: { kind: 'property', tile: 39 },
        winnerId: 'p2',
        amount: 300,
      }),
    ).toBe('Beto se quedó con Puerto Madero por $ 300');
    expect(
      say({
        type: 'auctionClosed',
        lot: { kind: 'property', tile: 39 },
        winnerId: null,
        amount: 0,
      }),
    ).toBe('Nadie pujó por Puerto Madero');
    expect(say({ type: 'gameOver', winnerId: 'p1', reason: 'lastStanding', netWorth: {} })).toBe(
      '¡Ganó Ana!',
    );
  });

  it('todo evento real de una partida tiene texto o se omite a propósito (nunca rompe)', () => {
    let state = game.state;
    const events: GameEvent[] = [...game.events];
    for (let i = 0; i < 300 && state.phase.kind !== 'gameOver'; i += 1) {
      const actor =
        state.phase.kind === 'auction' ? state.phase.participants[0] : state.currentPlayerId;
      if (actor === undefined) break;
      const legal = toPlayerView(state, actor).legal;
      const action = legal[i % legal.length];
      if (action === undefined) break;
      const result = applyAction(state, actor, action);
      if (!result.ok) break;
      state = result.state;
      events.push(...result.events);
    }
    const finalView = toPlayerView(state, 'p1');
    for (const event of events) {
      const text = eventText(event, finalView, i18n);
      if (text !== null) expect(text).not.toMatch(/[{}]|event\./);
    }
  });
});
