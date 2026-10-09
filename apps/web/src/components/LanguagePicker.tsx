import { LOCALES } from '@gran-negocio/shared';
import { t, useLocale } from '../i18n.js';

/** Selector de idioma (M9): cada idioma con su propio nombre. */
export function LanguagePicker({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  return (
    <div role="group" aria-label={t('settings.language')} className={`flex gap-1 ${className}`}>
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={locale === option}
          data-locale={option}
          onClick={() => {
            setLocale(option);
          }}
          className={`rounded-full px-3 py-1 text-sm font-bold ring-2 ${locale === option ? 'bg-tinta text-papel ring-tinta' : 'bg-superficie ring-tinta/20'}`}
        >
          {t(`locale.${option}`)}
        </button>
      ))}
    </div>
  );
}
