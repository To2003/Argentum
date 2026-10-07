import { Panel } from '@gran-negocio/ui';
import { t } from '../i18n/es-AR.js';

export function Landing() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{t('app.title')}</h1>
      <p className="text-lg text-noche/80">{t('app.tagline')}</p>
      <Panel className="flex w-full flex-col gap-3">
        <button
          type="button"
          disabled
          className="rounded-xl bg-celeste px-4 py-3 font-bold text-noche disabled:opacity-60"
        >
          {t('landing.create')}
        </button>
        <button
          type="button"
          disabled
          className="rounded-xl border-2 border-noche px-4 py-3 font-bold disabled:opacity-60"
        >
          {t('landing.join')}
        </button>
        <p className="text-sm text-noche/70">{t('landing.comingSoon')}</p>
      </Panel>
    </main>
  );
}
