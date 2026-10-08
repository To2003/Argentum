import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import { animationMachine } from '../src/animation/sequencer.js';
import { STEP_MS, stepsFor } from '../src/animation/steps.js';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const start = (reducedMotion = false) => {
  const actor = createActor(animationMachine, { input: { positions: { p1: 38 }, reducedMotion } });
  actor.start();
  return actor;
};

const roll = stepsFor([
  { type: 'diceRolled', playerId: 'p1', dice: [1, 2], reason: 'move' },
  { type: 'moved', playerId: 'p1', from: 38, to: 1, steps: 3, passedGo: true, cause: 'dice' },
]);

describe('secuenciador de animaciones', () => {
  it('reproduce dados y saltos de a uno y termina donde dice el server', () => {
    const actor = start();
    actor.send({ type: 'ENQUEUE', steps: roll, target: { p1: 1 } });
    expect(actor.getSnapshot().context.dice).toEqual([1, 2]);
    expect(actor.getSnapshot().context.positions['p1']).toBe(38);
    vi.advanceTimersByTime(STEP_MS.dice);
    expect(actor.getSnapshot().context.positions['p1']).toBe(39);
    vi.advanceTimersByTime(STEP_MS.hop);
    expect(actor.getSnapshot().context.positions['p1']).toBe(0);
    vi.advanceTimersByTime(STEP_MS.hop * 2);
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.positions['p1']).toBe(1);
  });

  it('con movimiento reducido llega al final enseguida', () => {
    const actor = start(true);
    actor.send({ type: 'ENQUEUE', steps: roll, target: { p1: 1 } });
    vi.advanceTimersByTime(1);
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.positions['p1']).toBe(1);
  });

  it('una tanda sin pasos (snapshot) acomoda las fichas al instante', () => {
    const actor = start();
    actor.send({ type: 'ENQUEUE', steps: [], target: { p1: 10, p2: 5 } });
    expect(actor.getSnapshot().context.positions).toEqual({ p1: 10, p2: 5 });
  });

  it('tocar la carta la saltea', () => {
    const actor = start();
    actor.send({
      type: 'ENQUEUE',
      steps: [{ kind: 'card', playerId: 'p1', deck: 'chance', cardId: 'chance.aguinaldo' }],
      target: { p1: 38 },
    });
    expect(actor.getSnapshot().context.card?.cardId).toBe('chance.aguinaldo');
    actor.send({ type: 'SKIP' });
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.card).toBeNull();
  });

  it('las tandas que llegan mientras se anima se encolan', () => {
    const actor = start();
    actor.send({ type: 'ENQUEUE', steps: roll, target: { p1: 1 } });
    actor.send({ type: 'ENQUEUE', steps: [{ kind: 'jail', playerId: 'p1' }], target: { p1: 10 } });
    vi.advanceTimersByTime(STEP_MS.dice + STEP_MS.hop * 3 + STEP_MS.jail);
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.positions['p1']).toBe(10);
  });
});
