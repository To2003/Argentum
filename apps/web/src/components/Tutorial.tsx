import { useState } from 'react';
import { t } from '../i18n.js';
import { Button, Dialog } from './ui.js';

const STEPS = ['goal', 'turn', 'rent', 'money', 'jail'] as const;

/** El tutorial corto de reglas (M9): cinco pasos, con teclado y lector de pantalla. */
export function Tutorial({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index] ?? 'goal';
  const last = index === STEPS.length - 1;
  return (
    <Dialog title={t('tutorial.open')} onClose={onClose}>
      <div data-testid="tutorial" aria-live="polite">
        <p className="text-sm text-tinta/70">
          {t('tutorial.step', { step: index + 1, total: STEPS.length })}
        </p>
        <h3 className="mt-1 font-display text-2xl font-extrabold">{t(`tutorial.${step}.title`)}</h3>
        <p className="mt-2 text-lg">{t(`tutorial.${step}.body`)}</p>
      </div>
      <div className="mt-6 flex justify-between gap-2">
        <Button
          variant="secondary"
          disabled={index === 0}
          onClick={() => {
            setIndex(index - 1);
          }}
        >
          {t('tutorial.prev')}
        </Button>
        <Button
          data-testid="tutorial-next"
          onClick={() => {
            if (last) onClose();
            else setIndex(index + 1);
          }}
        >
          {last ? t('tutorial.done') : t('tutorial.next')}
        </Button>
      </div>
    </Dialog>
  );
}
