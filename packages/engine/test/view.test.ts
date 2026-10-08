import { describe, expect, it } from 'vitest';
import { toPlayerView } from '../src/index.js';
import { newGame, roll } from './support.js';

describe('PlayerView', () => {
  it('no incluye rngState ni el orden de los mazos', () => {
    const state = newGame(3);
    const view = toPlayerView(state, 'p1');
    const json = JSON.stringify(view);
    expect(view).not.toHaveProperty('rngState');
    expect(view).not.toHaveProperty('seed');
    for (const word of state.rngState) expect(json).not.toContain(String(word));
    // Ningún id de carta del mazo aparece en la vista (solo las "Salí gratis" en mano).
    for (const cardId of [...state.decks.chance, ...state.decks.community]) {
      expect(json).not.toContain(cardId);
    }
    expect(view.decks).toEqual({ chance: { remaining: 16 }, community: { remaining: 16 } });
  });

  it('las "Salí gratis" en mano son públicas y el mazo cuenta una menos', () => {
    const state = newGame();
    state.players['p2']!.jailFreeCards = ['chance.jailFree'];
    state.decks.chance = state.decks.chance.filter((id) => id !== 'chance.jailFree');
    const view = toPlayerView(state, 'p1');
    expect(view.players.find((p) => p.id === 'p2')?.jailFreeCards).toEqual(['chance.jailFree']);
    expect(view.decks.chance.remaining).toBe(15);
  });

  it('trae las acciones legales del viewer; un espectador no tiene ninguna', () => {
    const state = newGame();
    expect(toPlayerView(state, 'p1').legal).toEqual([{ type: 'rollDice' }]);
    expect(toPlayerView(state, 'p2').legal).toEqual([]);
    expect(toPlayerView(state, null).legal).toEqual([]);
  });

  it('copia: mutar la vista no toca el estado', () => {
    const state = roll(newGame(), 'p1', [1, 2]).state;
    const view = toPlayerView(state, 'p1') as unknown as {
      phase: { tile: number };
      turn: { lastRoll: number[] };
    };
    view.phase.tile = 99;
    view.turn.lastRoll[0] = 6;
    expect(state.phase).toEqual({ kind: 'awaitingPurchase', tile: 3 });
    expect(state.turn.lastRoll).toEqual([1, 2]);
  });

  it('jugadores en orden de turno, con lo público de cada uno', () => {
    const view = toPlayerView(newGame(3), 'p2');
    expect(view.players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(Object.keys(view.players[0] ?? {}).sort()).toEqual(
      [
        'bankrupt',
        'cash',
        'id',
        'inJail',
        'jailAttempts',
        'jailFreeCards',
        'name',
        'position',
        'tokenId',
      ].sort(),
    );
  });
});
