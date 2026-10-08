import type { Dice, GameEvent } from '@gran-negocio/engine';
import type { DeckKind } from '@gran-negocio/shared';

/**
 * Lo que la animación muestra, paso a paso (SPEC.md §7.2). Se arma a partir
 * de los eventos de una actualización: la UI anima hacia el resultado que ya
 * decidió el server, nunca al revés.
 */
export type Step =
  /** Los dados ruedan y caen en este resultado. */
  | { readonly kind: 'dice'; readonly dice: Dice }
  /** La ficha avanza (o retrocede) una casilla. */
  | { readonly kind: 'hop'; readonly playerId: string; readonly to: number; readonly fast: boolean }
  /** La ficha salta directo (a la cárcel). */
  | { readonly kind: 'jail'; readonly playerId: string }
  /** Se da vuelta una carta. */
  | {
      readonly kind: 'card';
      readonly playerId: string;
      readonly deck: DeckKind;
      readonly cardId: string;
    };

/** Cuánto dura cada paso, en ms (con movimiento reducido todo es 0). */
export const STEP_MS = {
  dice: 650,
  hop: 170,
  fastHop: 70,
  jail: 600,
  card: 2600,
} as const;

export function stepDuration(step: Step, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  switch (step.kind) {
    case 'dice':
      return STEP_MS.dice;
    case 'hop':
      return step.fast ? STEP_MS.fastHop : STEP_MS.hop;
    case 'jail':
      return STEP_MS.jail;
    case 'card':
      return STEP_MS.card;
  }
}

/** Arma los pasos de una tanda de eventos. */
export function stepsFor(events: readonly GameEvent[]): Step[] {
  const steps: Step[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'diceRolled':
        if (event.reason !== 'turnOrder') steps.push({ kind: 'dice', dice: event.dice });
        break;
      case 'moved': {
        // Las cartas mueven lejos: saltos más rápidos para no hacer esperar.
        const fast = event.cause === 'card';
        const direction = Math.sign(event.steps);
        for (let i = 1; i <= Math.abs(event.steps); i += 1) {
          const to = (((event.from + direction * i) % 40) + 40) % 40;
          steps.push({ kind: 'hop', playerId: event.playerId, to, fast });
        }
        break;
      }
      case 'sentToJail':
        steps.push({ kind: 'jail', playerId: event.playerId });
        break;
      case 'cardDrawn':
        steps.push({
          kind: 'card',
          playerId: event.playerId,
          deck: event.deck,
          cardId: event.cardId,
        });
        break;
      default:
        break;
    }
  }
  return steps;
}
