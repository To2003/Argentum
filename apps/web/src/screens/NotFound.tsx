import { Link } from 'react-router';
import { t } from '../i18n.js';

export function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-3xl font-black">{t('notFound.title')}</h1>
      <Link to="/" className="font-bold text-celeste underline">
        {t('notFound.back')}
      </Link>
    </main>
  );
}
