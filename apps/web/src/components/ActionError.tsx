import { t } from '../i18n.js';
import { Button } from './ui.js';

/**
 * El error de una acción. Si el server no respondió (no despertó a tiempo),
 * con un botón para volver a intentar lo mismo.
 */
export function ActionError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: (() => void) | null;
}) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3" data-testid="action-error">
      <p className="font-bold text-fileteado">{message}</p>
      {onRetry !== null && (
        <Button variant="secondary" data-testid="retry" onClick={onRetry}>
          {t('wake.retry')}
        </Button>
      )}
    </div>
  );
}
