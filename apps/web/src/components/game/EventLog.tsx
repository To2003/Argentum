import type { PlayerView } from '@gran-negocio/engine';
import { useMemo, useState } from 'react';
import { EVENT_CATEGORIES, eventCategory, type EventCategory } from '../../game/eventCategory.js';
import { eventText } from '../../game/eventText.js';
import { i18n, t } from '../../i18n.js';
import type { LoggedEvent } from '../../store/game.js';

/**
 * El registro de lo que va pasando, lo último arriba, anunciado a lectores de
 * pantalla. Se filtra por categoría: plata, propiedades, cartas o turnos.
 */
export function EventLog({ log, view }: { log: readonly LoggedEvent[]; view: PlayerView }) {
  const [filter, setFilter] = useState<EventCategory | 'all'>('all');
  const lines = useMemo(
    () =>
      log
        .filter((entry) => filter === 'all' || eventCategory(entry.event) === filter)
        .map((entry) => ({ id: entry.id, text: eventText(entry.event, view, i18n) }))
        .filter((line): line is { id: number; text: string } => line.text !== null)
        .reverse()
        .slice(0, 60),
    [log, view, filter],
  );
  return (
    <section aria-labelledby="log-title" className="rounded-xl bg-superficie p-3">
      <h2 id="log-title" className="mb-2 font-display text-base font-extrabold">
        {t('log.title')}
      </h2>
      <div
        role="group"
        aria-label={t('log.filter')}
        className="mb-2 flex flex-wrap gap-1"
        data-testid="log-filter"
      >
        {(['all', ...EVENT_CATEGORIES] as const).map((category) => (
          <button
            key={category}
            type="button"
            aria-pressed={filter === category}
            data-category={category}
            onClick={() => {
              setFilter(category);
            }}
            className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${filter === category ? 'bg-tinta text-papel ring-tinta' : 'bg-papel ring-tinta/25'}`}
          >
            {t(`log.category.${category}`)}
          </button>
        ))}
      </div>
      {lines.length === 0 ? (
        <p className="text-sm text-tinta/70">
          {filter === 'all' || log.length === 0 ? t('log.empty') : t('log.emptyFilter')}
        </p>
      ) : (
        <ol
          aria-live="polite"
          className="max-h-64 space-y-1 overflow-y-auto text-sm"
          data-testid="event-log"
        >
          {lines.map((line) => (
            <li key={line.id} className="border-b border-tinta/5 pb-1 last:border-0">
              {line.text}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
