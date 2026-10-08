import type { Card } from '../cards.js';
import type { ColorGroup, Tile } from '../board.js';
import { en } from './en.js';
import { esAR } from './es-AR.js';
import type {
  Dictionary,
  Locale,
  Message,
  MessageKey,
  ParamValue,
  PluralMessage,
  TranslateArgs,
} from './types.js';

export const DICTIONARIES: Readonly<Record<Locale, Readonly<Record<MessageKey, Message>>>> = {
  'es-AR': esAR satisfies Dictionary,
  en,
};

/**
 * La plata del juego es "pesos del juego": siempre con `$` y sin decimales.
 * En es-AR sale `$ 1.500`; en inglés, `$1,500`.
 */
const CURRENCY: Readonly<Record<Locale, { readonly locale: string; readonly currency: string }>> = {
  'es-AR': { locale: 'es-AR', currency: 'ARS' },
  en: { locale: 'en-US', currency: 'USD' },
};

/** Sin `this`: los métodos se pueden desestructurar (`const { t } = translator`). */
export interface Translator {
  readonly locale: Locale;
  /** Texto de una clave conocida; los parámetros se chequean al compilar. */
  readonly t: <K extends MessageKey>(key: K, ...args: TranslateArgs<K>) => string;
  /**
   * Para claves que salen de los datos (`nameKey`, `textKey`). Si la clave no
   * existe devuelve la clave misma: se ve el bug en pantalla en vez de romper.
   * Los tests garantizan que toda clave de board.json y cards.json existe.
   */
  readonly translate: (key: string, params?: Readonly<Record<string, ParamValue>>) => string;
  readonly has: (key: string) => key is MessageKey;
  readonly money: (amount: number) => string;
  readonly number: (value: number) => string;
  /** Nombre de la casilla, genérico si es una marca y la sala no usa marcas reales. */
  readonly tileName: (tile: Tile, useRealBrands: boolean) => string;
  /** La bajada de la casilla ("La Boca", "Salta"…), si tiene. */
  readonly tileDetail: (tile: Tile) => string | undefined;
  readonly groupName: (group: ColorGroup) => string;
  /** Texto de una carta con sus montos. `salary` es el cobro de la Salida de la sala. */
  readonly cardText: (card: Card, rules: { readonly salary: number }) => string;
}

const PARAM = /\{(\w+)\}/g;

export function createTranslator(locale: Locale): Translator {
  const dictionary = DICTIONARIES[locale];
  const plurals = new Intl.PluralRules(locale);
  const numbers = new Intl.NumberFormat(locale);
  const { locale: currencyLocale, currency } = CURRENCY[locale];
  const currencyFormat = new Intl.NumberFormat(currencyLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const interpolate = (text: string, params: Readonly<Record<string, ParamValue>>) =>
    text.replace(PARAM, (match, name: string) => {
      const value = params[name];
      if (value === undefined) return match;
      return typeof value === 'number' ? numbers.format(value) : value;
    });

  const isPlural = (message: Message): message is PluralMessage => typeof message !== 'string';

  const render = (message: Message, params: Readonly<Record<string, ParamValue>>): string => {
    if (!isPlural(message)) return interpolate(message, params);
    const count = typeof params['count'] === 'number' ? params['count'] : 0;
    const form = plurals.select(count) === 'one' ? message.one : message.other;
    return interpolate(form, params);
  };

  const has = (key: string): key is MessageKey => Object.hasOwn(dictionary, key);

  const translate = (key: string, params: Readonly<Record<string, ParamValue>> = {}) =>
    has(key) ? render(dictionary[key], params) : key;

  const money = (amount: number) => currencyFormat.format(amount);

  return {
    locale,
    t: (key, ...args) => render(dictionary[key], args[0] ?? {}),
    translate,
    has,
    money,
    number: (value) => numbers.format(value),
    tileName: (tile, useRealBrands) =>
      translate(tile.brand === true && !useRealBrands ? `${tile.nameKey}.generic` : tile.nameKey),
    tileDetail: (tile) => {
      const key = `${tile.nameKey}.detail`;
      return has(key) ? translate(key) : undefined;
    },
    groupName: (group) => translate(`group.${group}`),
    cardText: (card, rules) => translate(card.textKey, cardParams(card, rules.salary, money)),
  };
}

/** Los parámetros que puede usar el texto de una carta, sacados de su efecto. */
export function cardParams(
  card: Card,
  salary: number,
  money: (amount: number) => string,
): Record<string, ParamValue> {
  const params: Record<string, ParamValue> = { salary: money(salary) };
  const { effect } = card;
  switch (effect.type) {
    case 'gain':
    case 'pay':
    case 'gainFromEach':
    case 'payEach':
      params['amount'] = money(effect.amount);
      break;
    case 'repairs':
      params['perHouse'] = money(effect.perHouse);
      params['perHotel'] = money(effect.perHotel);
      break;
    case 'moveRelative':
      params['steps'] = Math.abs(effect.steps);
      break;
    case 'moveToNearest':
      params['multiplier'] =
        effect.target === 'utility' ? effect.diceMultiplier : effect.rentMultiplier;
      break;
    case 'moveTo':
    case 'goToJail':
    case 'jailFreeCard':
      break;
  }
  return params;
}
