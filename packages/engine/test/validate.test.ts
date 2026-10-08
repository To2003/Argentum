import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { actorOf, isLegalAction, PHASE_ACTIONS, validateAction } from '../src/index.js';
import { expectRejected, newGame, roll } from './support.js';

describe('validateAction', () => {
  it('jugador desconocido', () => {
    expectRejected(newGame(), 'zz', { type: 'rollDice' }, 'UNKNOWN_PLAYER');
  });

  it('fuera de turno', () => {
    expectRejected(newGame(), 'p2', { type: 'rollDice' }, 'NOT_YOUR_TURN');
  });

  it('acción que no corresponde a la fase', () => {
    expectRejected(newGame(), 'p1', { type: 'buyProperty' }, 'WRONG_PHASE');
    expectRejected(newGame(), 'p1', { type: 'declareBankruptcy' }, 'WRONG_PHASE');
  });

  it('partida terminada', () => {
    const state = newGame();
    state.phase = { kind: 'gameOver', winnerId: 'p1' };
    expect(validateAction(state, 'p1', { type: 'rollDice' })).toBe('GAME_OVER');
    expect(actorOf(state)).toBeNull();
  });

  it('isLegalAction es validateAction === null', () => {
    const state = roll(newGame(), 'p1', [1, 2]).state;
    expect(isLegalAction(state, 'p1', { type: 'buyProperty' })).toBe(true);
    expect(isLegalAction(state, 'p1', { type: 'endTurn' })).toBe(false);
  });

  it('una acción rechazada devuelve el mismo estado, sin tocarlo', () => {
    const state = newGame();
    const before = JSON.stringify(state);
    expectRejected(state, 'p2', { type: 'rollDice' }, 'NOT_YOUR_TURN');
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('tabla de transiciones vs. docs/turn-fsm.mmd', () => {
  it('el diagrama nombra exactamente las fases persistidas del engine', () => {
    const diagram = readFileSync(new URL('../../../docs/turn-fsm.mmd', import.meta.url), 'utf8');
    const declared = [...diagram.matchAll(/^\s*state\s+"[^"]*"\s+as\s+([a-zA-Z]\w*)\s*$/gm)].map(
      (m) => m[1],
    );
    expect(declared.sort()).toEqual(Object.keys(PHASE_ACTIONS).sort());
  });

  it('cada acción de la tabla aparece en el diagrama', () => {
    const diagram = readFileSync(new URL('../../../docs/turn-fsm.mmd', import.meta.url), 'utf8');
    for (const action of new Set(Object.values(PHASE_ACTIONS).flat())) {
      expect(diagram, action).toContain(action);
    }
  });
});
