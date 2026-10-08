import { useEffect } from 'react';
import { errorText } from '../game/errorText.js';
import { t } from '../i18n.js';
import { useGame } from '../store/game.js';

/** El último error de una acción, que se va solo a los 5 segundos. */
export function ErrorBanner() {
  const error = useGame((state) => state.error);
  const status = useGame((state) => state.status);
  const clear = useGame((state) => state.clearError);
  useEffect(() => {
    if (error === null) return undefined;
    const timer = setTimeout(clear, 5000);
    return () => {
      clearTimeout(timer);
    };
  }, [error, clear]);
  if (status === 'reconnecting') {
    return (
      <p role="status" className="fixed inset-x-0 top-0 z-50 bg-sol p-2 text-center font-bold">
        {t('room.reconnecting')}
      </p>
    );
  }
  if (error === null) return null;
  return (
    <p
      role="alert"
      className="fixed inset-x-0 top-0 z-50 bg-fileteado p-2 text-center font-bold text-white"
    >
      {errorText(error)}
    </p>
  );
}
