import type { esAR } from './es-AR.js';

export const LOCALES = ['es-AR', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es-AR';

/** Un plural: se elige la forma con `Intl.PluralRules` sobre el parámetro `count`. */
export interface PluralMessage {
  readonly one: string;
  readonly other: string;
}

export type Message = string | PluralMessage;

export type MessageKey = keyof typeof esAR;

/**
 * Un diccionario con exactamente las claves de es-AR, y plural donde es-AR
 * tiene plural. Que falte o sobre una clave no compila.
 */
export type Dictionary = {
  readonly [K in MessageKey]: (typeof esAR)[K] extends string ? string : PluralMessage;
};

/** Los `{param}` de un texto, como unión de literales. */
type ExtractParams<S extends string> = S extends `${string}{${infer Param}}${infer Rest}`
  ? Param | ExtractParams<Rest>
  : never;

type ParamsOf<M> = M extends string
  ? ExtractParams<M>
  : M extends PluralMessage
    ? ExtractParams<M['one']> | ExtractParams<M['other']> | 'count'
    : never;

export type MessageParams<K extends MessageKey> = ParamsOf<(typeof esAR)[K]>;

export type ParamValue = string | number;

/** Los parámetros que pide una clave: ninguno, o todos los que nombra el texto. */
export type TranslateArgs<K extends MessageKey> = [MessageParams<K>] extends [never]
  ? []
  : [
      params: Readonly<Record<MessageParams<K>, ParamValue>> &
        ((typeof esAR)[K] extends PluralMessage ? { readonly count: number } : unknown),
    ];
