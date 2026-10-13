import { useEffect, useState } from 'react';
import { t } from '../i18n.js';
import { WAKE_LIMIT_MS } from '../net/wake.js';
import { useGame } from '../store/game.js';

/**
 * "Despertando el server…" mientras se espera que responda (Render gratis se
 * duerme). Solo existe durante la espera: el contador es local, sin red.
 */
export function WakeNotice() {
  const since = useGame((state) => state.waking);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (since === null) return;
    // El primer tick puede tener un `now` viejo: el tiempo transcurrido se acota a 0.
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [since]);

  if (since === null) return null;
  const elapsed = Math.max(0, now - since);
  const seconds = Math.floor(elapsed / 1000);
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="wake-notice"
      className="fixed inset-x-0 top-0 z-50 flex justify-center p-3"
    >
      <div className="w-full max-w-md rounded-2xl bg-superficie p-4 shadow-[0_10px_30px_-12px_rgba(20,40,58,0.45)] ring-2 ring-sol">
        <p className="font-display text-lg font-extrabold">{t('wake.title')}</p>
        <p className="mt-1 text-sm text-tinta/80">{t('wake.body')}</p>
        <progress
          className="wake-progress mt-3 h-2 w-full"
          max={WAKE_LIMIT_MS}
          value={Math.min(elapsed, WAKE_LIMIT_MS)}
          aria-label={t('wake.progress')}
        />
        <p className="mt-1 text-right text-sm tabular-nums text-tinta/70">
          {t('wake.elapsed', { seconds })}
        </p>
      </div>
    </div>
  );
}
