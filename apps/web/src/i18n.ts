import { createTranslator, DEFAULT_LOCALE } from '@gran-negocio/shared';

/**
 * El traductor de la app. Por ahora un solo idioma fijo (es-AR); el selector
 * de idioma llega en M9 y este módulo pasa a ser un contexto de React.
 */
export const i18n = createTranslator(DEFAULT_LOCALE);
export const { t } = i18n;
