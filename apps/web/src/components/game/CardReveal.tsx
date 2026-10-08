import type { PlayerView } from '@gran-negocio/engine';
import { cardById, type DeckKind } from '@gran-negocio/shared';
import { i18n, t } from '../../i18n.js';

/**
 * La carta que se acaba de sacar, dándose vuelta en el centro del tablero
 * (SPEC.md §7.2). Tocarla la saca antes de tiempo.
 */
export function CardReveal({
  view,
  card,
  onSkip,
}: {
  view: PlayerView;
  card: { playerId: string; deck: DeckKind; cardId: string };
  onSkip: () => void;
}) {
  const player = view.players.find((p) => p.id === card.playerId);
  const chance = card.deck === 'chance';
  return (
    <button
      type="button"
      onClick={onSkip}
      className="card-flip absolute inset-[18%] z-20 [perspective:900px]"
      aria-label={t('event.cardDrawn', {
        name: player?.name ?? '',
        deck: t(chance ? 'deck.chance' : 'deck.community'),
        text: i18n.cardText(cardById(card.cardId), view.rules),
      })}
    >
      <span className="card-flip-inner relative block h-full w-full [transform-style:preserve-3d]">
        <span
          className={`absolute inset-0 grid place-items-center rounded-[3cqw] font-display text-[6cqw] font-extrabold text-white [backface-visibility:hidden] ${chance ? 'bg-fileteado' : 'bg-ink'}`}
        >
          {t(chance ? 'deck.chance' : 'deck.community')}
        </span>
        <span
          className={`absolute inset-0 flex flex-col justify-between rounded-[3cqw] bg-white p-[3cqw] text-left text-ink shadow-xl ring-[0.6cqw] [backface-visibility:hidden] [transform:rotateY(180deg)] ${chance ? 'ring-fileteado' : 'ring-ink'}`}
        >
          <span className="font-display text-[3.4cqw] font-extrabold">
            {t(chance ? 'deck.chance' : 'deck.community')}
          </span>
          <span className="text-[3.2cqw] leading-snug">
            {i18n.cardText(cardById(card.cardId), view.rules)}
          </span>
          <span className="text-[2.2cqw] text-tinta/60">{player?.name}</span>
        </span>
      </span>
    </button>
  );
}
