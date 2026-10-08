import type { GameEvent } from '@gran-negocio/engine';
import { useEffect } from 'react';
import { play } from './synth.js';

/**
 * Los efectos de cada actualización (SPEC.md §7.6). Los pasos de la ficha
 * suenan desde la animación; acá va el resto, una vez por tanda.
 */
export function useGameSounds(events: readonly GameEvent[], seq: number, me: string | null): void {
  useEffect(() => {
    const sounds = new Set<Parameters<typeof play>[0]>();
    for (const event of events) {
      switch (event.type) {
        case 'diceRolled':
          if (event.reason !== 'turnOrder') sounds.add('dice');
          break;
        case 'cardDrawn':
          sounds.add('card');
          break;
        case 'sentToJail':
          sounds.add('jail');
          break;
        case 'auctionClosed':
          sounds.add('hammer');
          break;
        case 'buildingBuilt':
          sounds.add('build');
          break;
        case 'gameOver':
          sounds.add('victory');
          break;
        case 'moneyTransferred':
          if (event.to === me) sounds.add('cash');
          else if (event.from === me) sounds.add('pay');
          break;
        default:
          break;
      }
    }
    for (const sound of sounds) play(sound);
    // Una vez por actualización.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);
}
