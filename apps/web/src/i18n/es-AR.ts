/**
 * Textos de la UI en español rioplatense.
 *
 * M0: un diccionario mínimo para que ningún componente tenga strings sueltos.
 * En M1 se reemplaza por la infraestructura de i18n definitiva.
 */
export const esAR = {
  'app.title': 'El Gran Negocio',
  'app.tagline': 'Comprá, cobrá y fundí a tus amigos. Online, desde la compu o el celu.',
  'landing.create': 'Crear partida',
  'landing.join': 'Unirme con código',
  'landing.comingSoon': 'Muy pronto, che.',
  'room.title': 'Sala {code}',
  'notFound.title': 'Esta página no existe',
  'notFound.back': 'Volver al inicio',
} as const;

export type MessageKey = keyof typeof esAR;

/** Busca el texto y reemplaza `{param}`. */
export function t(key: MessageKey, params: Readonly<Record<string, string>> = {}): string {
  return esAR[key].replace(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match);
}
