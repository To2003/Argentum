import { describe, expect, it } from 'vitest';
import { stepDuration, stepsFor } from '../src/animation/steps.js';

describe('pasos de animación', () => {
  it('una tirada: dados y un salto por casilla', () => {
    const steps = stepsFor([
      { type: 'diceRolled', playerId: 'p1', dice: [1, 2], reason: 'move' },
      { type: 'moved', playerId: 'p1', from: 38, to: 1, steps: 3, passedGo: true, cause: 'dice' },
      { type: 'landed', playerId: 'p1', tile: 1 },
    ]);
    expect(steps).toEqual([
      { kind: 'dice', dice: [1, 2] },
      { kind: 'hop', playerId: 'p1', to: 39, fast: false },
      { kind: 'hop', playerId: 'p1', to: 0, fast: false },
      { kind: 'hop', playerId: 'p1', to: 1, fast: false },
    ]);
  });

  it('retroceder salta hacia atrás; las cartas saltan rápido', () => {
    const steps = stepsFor([
      { type: 'cardDrawn', playerId: 'p1', deck: 'chance', cardId: 'chance.goBack3' },
      { type: 'moved', playerId: 'p1', from: 1, to: 38, steps: -3, passedGo: false, cause: 'card' },
    ]);
    expect(steps.slice(1).map((s) => (s.kind === 'hop' ? s.to : -1))).toEqual([0, 39, 38]);
    expect(steps[1]).toMatchObject({ fast: true });
    expect(steps[0]).toMatchObject({ kind: 'card', cardId: 'chance.goBack3' });
  });

  it('ir preso es un salto directo; el orden inicial no se anima', () => {
    expect(
      stepsFor([
        { type: 'diceRolled', playerId: 'p1', dice: [6, 6], reason: 'turnOrder' },
        { type: 'sentToJail', playerId: 'p1', cause: 'tile' },
      ]),
    ).toEqual([{ kind: 'jail', playerId: 'p1' }]);
  });

  it('con movimiento reducido no hay demora', () => {
    expect(stepDuration({ kind: 'dice', dice: [1, 1] }, true)).toBe(0);
    expect(
      stepDuration({ kind: 'hop', playerId: 'p1', to: 2, fast: false }, false),
    ).toBeGreaterThan(0);
  });
});
