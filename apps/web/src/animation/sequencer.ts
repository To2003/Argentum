import type { Dice } from '@gran-negocio/engine';
import { assign, setup } from 'xstate';
import { stepDuration, type Step } from './steps.js';

/**
 * Secuenciador de animaciones (ADR 0004: XState solo en el cliente, para
 * secuenciar). Recibe tandas de pasos y los reproduce de a uno, cada uno con
 * su duración; al vaciarse la cola, las fichas quedan donde dice el server.
 */
export interface AnimationContext {
  readonly queue: readonly Step[];
  readonly current: Step | null;
  /** Dónde se dibuja cada ficha ahora (puede ir detrás del estado real). */
  readonly positions: Readonly<Record<string, number>>;
  /** Dónde tienen que terminar (el estado real). */
  readonly target: Readonly<Record<string, number>>;
  readonly dice: Dice | null;
  readonly card: Extract<Step, { kind: 'card' }> | null;
  readonly reducedMotion: boolean;
}

export type AnimationEvent =
  | { type: 'ENQUEUE'; steps: readonly Step[]; target: Readonly<Record<string, number>> }
  /** Saltear lo que falta de la carta (tocarla). */
  | { type: 'SKIP' }
  | { type: 'SET_REDUCED_MOTION'; value: boolean };

const apply = (context: AnimationContext, step: Step): Partial<AnimationContext> => {
  switch (step.kind) {
    case 'dice':
      return { dice: step.dice, card: null };
    case 'hop':
      return { positions: { ...context.positions, [step.playerId]: step.to } };
    case 'jail':
      return { positions: { ...context.positions, [step.playerId]: 10 } };
    case 'card':
      return { card: step };
  }
};

export const animationMachine = setup({
  types: {
    context: {} as AnimationContext,
    events: {} as AnimationEvent,
    input: {} as { positions: Readonly<Record<string, number>>; reducedMotion: boolean },
  },
  actions: {
    enqueue: assign(({ context, event }) =>
      event.type === 'ENQUEUE'
        ? { queue: [...context.queue, ...event.steps], target: event.target }
        : {},
    ),
    takeNext: assign(({ context }) => {
      const [next, ...rest] = context.queue;
      if (next === undefined) return { current: null };
      return { ...apply(context, next), current: next, queue: rest };
    }),
    /** Movimiento reducido: sin pasos, directo al resultado (con los últimos dados). */
    instant: assign(({ event }) => {
      if (event.type !== 'ENQUEUE') return {};
      const lastDice = [...event.steps].reverse().find((step) => step.kind === 'dice');
      return {
        queue: [],
        current: null,
        card: null,
        positions: event.target,
        target: event.target,
        ...(lastDice?.kind === 'dice' ? { dice: lastDice.dice } : {}),
      };
    }),
    settle: assign(({ context }) => ({
      positions: context.target,
      current: null,
      card: null,
    })),
    setReduced: assign(({ event }) =>
      event.type === 'SET_REDUCED_MOTION' ? { reducedMotion: event.value } : {},
    ),
  },
  guards: {
    hasQueue: ({ context }) => context.queue.length > 0,
    reduced: ({ context }) => context.reducedMotion,
  },
  delays: {
    step: ({ context }) =>
      context.current === null ? 0 : stepDuration(context.current, context.reducedMotion),
  },
}).createMachine({
  id: 'animation',
  context: ({ input }) => ({
    queue: [],
    current: null,
    positions: input.positions,
    target: input.positions,
    dice: null,
    card: null,
    reducedMotion: input.reducedMotion,
  }),
  initial: 'idle',
  on: {
    SET_REDUCED_MOTION: { actions: 'setReduced' },
  },
  states: {
    idle: {
      on: {
        ENQUEUE: [
          { guard: 'reduced', actions: 'instant' },
          { guard: ({ event }) => event.steps.length > 0, target: 'playing', actions: 'enqueue' },
          { actions: ['enqueue', 'settle'] },
        ],
      },
    },
    playing: {
      entry: 'takeNext',
      on: {
        ENQUEUE: { actions: 'enqueue' },
        SKIP: [
          { guard: 'hasQueue', target: 'playing', reenter: true },
          { target: 'idle', actions: 'settle' },
        ],
      },
      after: {
        step: [
          { guard: 'hasQueue', target: 'playing', reenter: true },
          { target: 'idle', actions: 'settle' },
        ],
      },
    },
  },
});
