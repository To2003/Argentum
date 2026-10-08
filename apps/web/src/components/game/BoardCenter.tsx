import type { PlayerView } from '@gran-negocio/engine';
import { i18n, t } from '../../i18n.js';
import { Dice3D } from './Dice3D.js';

/**
 * El centro del tablero: el único lugar con gesto de marca. El nombre en
 * Bricolage a todo peso, un sol de mayo estilizado y los dados de la última
 * tirada. Todo lo demás es tranquilo.
 */
export function BoardCenter({
  view,
  dice,
  rolling,
  seed,
  reducedMotion,
}: {
  view: PlayerView;
  /** Sube con cada tirada (reinicia la animación de los dados). */
  seed: number;
  reducedMotion: boolean;
  /** Los dados que muestra la animación (los del server, al terminar de rodar). */
  dice: readonly [number, number] | null;
  rolling: boolean;
}) {
  const roll = dice ?? view.turn.lastRoll;
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 200 200"
        className="pointer-events-none absolute -right-[12%] -top-[14%] w-[55%] opacity-25"
      >
        {Array.from({ length: 16 }, (_, i) => (
          <path
            key={i}
            d={i % 2 === 0 ? 'M100 8 L106 60 L94 60 Z' : 'M100 18 Q112 40 100 60 Q88 40 100 18 Z'}
            fill="#f2b705"
            transform={`rotate(${i * 22.5} 100 100)`}
          />
        ))}
        <circle cx="100" cy="100" r="38" fill="#f2b705" />
      </svg>
      <p className="relative text-center font-display text-[7.5cqw] font-extrabold leading-[0.85] tracking-[-0.03em] text-tinta">
        El Gran <br />
        Negocio
      </p>
      <div className="relative flex items-center gap-[1.5cqw]" aria-live="polite">
        {roll !== null ? (
          <>
            <span className="sr-only">{t('game.lastRoll', { a: roll[0], b: roll[1] })}</span>
            <span aria-hidden="true" className="flex gap-[1.2cqw]">
              <Dice3D value={roll[0]} rolling={rolling} seed={seed} reducedMotion={reducedMotion} />
              <Dice3D
                value={roll[1]}
                rolling={rolling}
                seed={seed + 1}
                reducedMotion={reducedMotion}
              />
            </span>
          </>
        ) : null}
      </div>
      <p className="relative text-[max(1.6cqw,0.8rem)] text-tinta/70">
        {t('game.round', { round: view.round })}
        {view.rules.freeParkingPot && ` — ${t('game.pot', { amount: i18n.money(view.pot) })}`}
      </p>
      <p className="relative text-[max(1.3cqw,0.7rem)] text-tinta/60">
        {t('game.bankStock', { houses: view.bank.houses, hotels: view.bank.hotels })}
      </p>
    </>
  );
}
