import { i18n, t } from '../i18n.js';

/** El texto de un error del server: el específico si existe, si no el genérico con su código. */
export function errorText(code: string): string {
  const key = `error.${code}`;
  return i18n.has(key) ? i18n.translate(key) : t('error.generic', { code });
}
