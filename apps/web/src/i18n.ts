import {
  createTranslator,
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  type Translator,
} from '@gran-negocio/shared';
import { create } from 'zustand';

/**
 * El traductor de la app (M9: es-AR o inglés). `i18n` y `t` delegan en el
 * idioma elegido; al cambiarlo, `App` vuelve a montar el árbol con la clave
 * del idioma, así que los componentes no necesitan suscribirse.
 *
 * El idioma se guarda en el navegador; por defecto, es-AR (SPEC.md §2).
 */
const KEY = 'gran-negocio:locale';

function load(): Locale {
  try {
    const stored = localStorage.getItem(KEY);
    return LOCALES.find((locale) => locale === stored) ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

let current: Translator = createTranslator(load());

export const i18n: Translator = {
  get locale() {
    return current.locale;
  },
  t: (key, ...args) => current.t(key, ...args),
  translate: (key, params) => current.translate(key, params),
  has: (key): key is Parameters<Translator['t']>[0] => current.has(key),
  money: (amount) => current.money(amount),
  number: (value) => current.number(value),
  tileName: (tile, useRealBrands) => current.tileName(tile, useRealBrands),
  tileDetail: (tile) => current.tileDetail(tile),
  groupName: (group) => current.groupName(group),
  cardText: (card, rules) => current.cardText(card, rules),
};

export const { t } = i18n;

export const useLocale = create<{ locale: Locale; setLocale: (locale: Locale) => void }>()(
  (set) => ({
    locale: current.locale,
    setLocale: (locale) => {
      current = createTranslator(locale);
      try {
        localStorage.setItem(KEY, locale);
      } catch {
        // Solo una comodidad: sin storage, dura lo que la pestaña.
      }
      document.documentElement.lang = locale;
      set({ locale });
    },
  }),
);

document.documentElement.lang = current.locale;
