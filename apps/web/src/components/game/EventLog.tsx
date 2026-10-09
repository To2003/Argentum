import type { PlayerView } from '@gran-negocio/engine';
import { useMemo } from 'react';
import { eventText } from '../../game/eventText.js';
import { i18n, t } from '../../i18n.js';
import type { LoggedEvent } from '../../store/game.js';

/** El registro de lo que va pasando, lo último arriba, anunciado a lectores de pantalla. */
export function EventLog({ log, view }: { log: readonly LoggedEvent[]; view: PlayerView }) {
  const lines = useMemo(
    () =>
      log
        .map((entry) => ({ id: entry.id, text: eventText(entry.event, view, i18n) }))
        .filter((line): line is { id: number; text: string } => line.text !== null)
        .reverse()
        .slice(0, 60),
    [log, view],
  );
  return (
    <section aria-labelledby="log-title" className="rounded-xl bg-superficie p-3">
      <h2 id="log-title" className="mb-2 font-display text-base font-extrabold">
        {t('log.title')}
      </h2>
      {lines.length === 0 ? (
        <p className="text-sm text-tinta/70">{t('log.empty')}</p>
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
