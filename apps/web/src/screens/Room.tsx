import { useParams } from 'react-router';
import { t } from '../i18n.js';

export function Room() {
  const { code = '' } = useParams();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center justify-center px-4">
      <h1 className="text-3xl font-black">{t('room.title', { code: code.toUpperCase() })}</h1>
    </main>
  );
}
