import { i18n, t } from '../i18n.js';

/** Por qué una jugada no se puede, a partir del ErrorCode del engine. */
export function reasonText(code: string | null): string | null {
  if (code === null) return null;
  const key = `reason.${code}`;
  return i18n.has(key) ? i18n.translate(key) : t('reason.generic');
}
