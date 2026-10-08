import type { GameEvent, PlayerView } from '@gran-negocio/engine';
import { useActorRef, useSelector } from '@xstate/react';
import { useEffect } from 'react';
import { play } from '../audio/synth.js';
import { animationMachine } from './sequencer.js';
import { stepsFor } from './steps.js';
import { useReducedMotion } from './useReducedMotion.js';

const positionsOf = (view: PlayerView): Record<string, number> =>
  Object.fromEntries(view.players.map((player) => [player.id, player.position]));

/**
 * Conecta el secuenciador con las actualizaciones del server: cada
 * actualización (`seq`) encola sus pasos. Devuelve lo que hay que dibujar ahora.
 */
export function useAnimation(view: PlayerView, events: readonly GameEvent[], seq: number) {
  const reducedMotion = useReducedMotion();
  const actor = useActorRef(animationMachine, {
    input: { positions: positionsOf(view), reducedMotion },
  });

  useEffect(() => {
    actor.send({ type: 'SET_REDUCED_MOTION', value: reducedMotion });
  }, [actor, reducedMotion]);

  // Una tanda por actualización (incluido un snapshot, sin eventos: solo se acomoda).
  useEffect(() => {
    actor.send({ type: 'ENQUEUE', steps: stepsFor(events), target: positionsOf(view) });
    // `view` y `events` llegan juntos con cada `seq`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor, seq]);

  // Un "tac" por cada casilla que salta la ficha.
  useEffect(() => {
    let last: unknown = null;
    const subscription = actor.subscribe((snapshot) => {
      const step = snapshot.context.current;
      if (step === last) return;
      last = step;
      if (step?.kind === 'hop') play('step');
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [actor]);

  const positions = useSelector(actor, (snapshot) => snapshot.context.positions);
  const dice = useSelector(actor, (snapshot) => snapshot.context.dice);
  const card = useSelector(actor, (snapshot) => snapshot.context.card);
  const rolling = useSelector(actor, (snapshot) => snapshot.context.current?.kind === 'dice');
  const jailed = useSelector(actor, (snapshot) =>
    snapshot.context.current?.kind === 'jail' ? snapshot.context.current.playerId : null,
  );
  return {
    positions,
    dice,
    card,
    rolling,
    jailed,
    reducedMotion,
    skip: () => {
      actor.send({ type: 'SKIP' });
    },
  };
}
