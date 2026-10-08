import { describe, expect, it } from 'vitest';
import {
  BOARD,
  cardById,
  cardParams,
  COLOR_GROUPS,
  createTranslator,
  DECKS,
  DEFAULT_RULES,
  DICTIONARIES,
  LOCALES,
  tileAt,
  type Message,
} from '../src/index.js';

/** Intl usa espacio duro entre `$` y el número; los tests comparan con espacio común. */
const plain = (text: string) => text.replace(/\u00a0/g, ' ');

const paramsOf = (message: Message): string[] => {
  const forms = typeof message === 'string' ? [message] : [message.one, message.other];
  const names = forms.flatMap((form) => [...form.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? ''));
  if (typeof message !== 'string') names.push('count');
  return [...new Set(names)].sort();
};

const esAR = DICTIONARIES['es-AR'];
const en = DICTIONARIES.en;
const ALL_CARDS = [...DECKS.chance, ...DECKS.community];

describe('diccionarios', () => {
  it('es-AR y en tienen exactamente las mismas claves', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(esAR).sort());
  });

  it.each(LOCALES)('%s no tiene textos vacíos', (locale) => {
    for (const [key, message] of Object.entries(DICTIONARIES[locale])) {
      const forms = typeof message === 'string' ? [message] : [message.one, message.other];
      for (const form of forms) expect(form.trim(), key).not.toBe('');
    }
  });

  it('cada clave usa los mismos parámetros y la misma forma (plural o no) en los dos idiomas', () => {
    for (const key of Object.keys(esAR) as (keyof typeof esAR)[]) {
      expect(typeof en[key], key).toBe(typeof esAR[key]);
      expect(paramsOf(en[key]), key).toEqual(paramsOf(esAR[key]));
    }
  });
});

describe('claves que salen de los datos', () => {
  it.each(LOCALES)('%s: toda casilla tiene nombre', (locale) => {
    for (const tile of BOARD) expect(DICTIONARIES[locale], tile.id).toHaveProperty([tile.nameKey]);
  });

  it.each(LOCALES)('%s: toda casilla con brand: true tiene nombre genérico', (locale) => {
    const brands = BOARD.filter((tile) => tile.brand === true);
    expect(brands.length).toBeGreaterThan(0);
    for (const tile of brands) {
      expect(DICTIONARIES[locale], tile.id).toHaveProperty([`${tile.nameKey}.generic`]);
    }
  });

  it('solo las marcas tienen nombre genérico, y toda bajada es de una casilla que existe', () => {
    const nameKeys = new Set(BOARD.map((tile) => tile.nameKey));
    const brandKeys = new Set(
      BOARD.filter((tile) => tile.brand === true).map((tile) => tile.nameKey),
    );
    for (const key of Object.keys(esAR).filter((k) => k.startsWith('tile.'))) {
      if (key.endsWith('.generic'))
        expect(brandKeys, key).toContain(key.slice(0, -'.generic'.length));
      else if (key.endsWith('.detail'))
        expect(nameKeys, key).toContain(key.slice(0, -'.detail'.length));
      else expect(nameKeys, key).toContain(key);
    }
  });

  it.each(LOCALES)('%s: toda carta tiene texto y todos sus parámetros se completan', (locale) => {
    const translator = createTranslator(locale);
    for (const card of ALL_CARDS) {
      expect(translator.has(card.textKey), card.id).toBe(true);
      const message = DICTIONARIES[locale][card.textKey as keyof typeof esAR];
      const provided = Object.keys(cardParams(card, 200, translator.money));
      for (const param of paramsOf(message))
        expect(provided, `${card.id}: {${param}}`).toContain(param);
      expect(translator.cardText(card, DEFAULT_RULES), card.id).not.toMatch(/[{}]/);
    }
  });

  it.each(LOCALES)('%s: todo grupo y toda regla configurable tiene etiqueta', (locale) => {
    const translator = createTranslator(locale);
    for (const group of COLOR_GROUPS) expect(translator.has(`group.${group}`), group).toBe(true);
    for (const rule of Object.keys(DEFAULT_RULES))
      expect(translator.has(`rules.${rule}`), rule).toBe(true);
  });
});

describe('translator', () => {
  const es = createTranslator('es-AR');
  const english = createTranslator('en');

  it('formatea la plata como pesos del juego', () => {
    expect(plain(es.money(1500))).toBe('$ 1.500');
    expect(plain(es.money(1_000_000))).toBe('$ 1.000.000');
    expect(plain(es.money(-25))).toBe('-$ 25');
    expect(english.money(1500)).toBe('$1,500');
  });

  it('interpola y formatea números con separador de miles', () => {
    expect(es.t('room.title', { code: 'ABC123' })).toBe('Sala ABC123');
    expect(es.number(12500)).toBe('12.500');
  });

  it('elige el plural con Intl.PluralRules', () => {
    expect(es.t('lobby.playerCount', { count: 1 })).toBe('1 jugador');
    expect(es.t('lobby.playerCount', { count: 0 })).toBe('0 jugadores');
    expect(es.t('lobby.playerCount', { count: 4 })).toBe('4 jugadores');
    expect(english.t('lobby.playerCount', { count: 1 })).toBe('1 player');
  });

  it('genericiza solo las marcas cuando la sala no usa nombres reales', () => {
    const edenor = tileAt(12);
    const aysa = tileAt(28);
    const caminito = tileAt(1);
    const subwayA = tileAt(5);
    expect(es.tileName(edenor, true)).toBe('Edenor');
    expect(es.tileName(edenor, false)).toBe('Compañía de Luz');
    expect(es.tileName(aysa, false)).toBe('Compañía de Agua');
    expect(english.tileName(aysa, false)).toBe('Water Works');
    expect(es.tileName(caminito, false)).toBe('Caminito');
    expect(es.tileName(subwayA, false)).toBe('Subte Línea A');
  });

  it('devuelve la bajada de la casilla si tiene', () => {
    expect(es.tileDetail(tileAt(1))).toBe('La Boca');
    expect(es.tileDetail(tileAt(39))).toBe('Puente de la Mujer');
    expect(es.tileDetail(tileAt(0))).toBeUndefined();
  });

  it('arma el texto de las cartas con los montos del efecto y de la sala', () => {
    expect(plain(es.cardText(cardById('community.birthday'), DEFAULT_RULES))).toBe(
      'Es tu cumpleaños: cada jugador te da $ 10.',
    );
    expect(plain(es.cardText(cardById('chance.advanceToGo'), { salary: 300 }))).toBe(
      'Avanzá hasta la Salida. Cobrá $ 300.',
    );
    expect(plain(es.cardText(cardById('community.streetRepairs'), DEFAULT_RULES))).toBe(
      'Arreglo de calles de tu barrio: pagá $ 40 por casa y $ 115 por hotel.',
    );
    expect(es.cardText(cardById('chance.goBack3'), DEFAULT_RULES)).toBe('Retrocedé 3 casillas.');
    expect(es.cardText(cardById('chance.nearestUtility'), DEFAULT_RULES)).toContain('10 veces');
  });

  it('una clave desconocida se ve tal cual, sin romper', () => {
    expect(es.translate('tile.nowhere')).toBe('tile.nowhere');
    expect(es.has('tile.nowhere')).toBe(false);
  });

  it('las claves y los parámetros se chequean al compilar', () => {
    // Nunca se ejecuta: lo valida `pnpm typecheck`. Si alguna de estas líneas
    // compilara, @ts-expect-error haría fallar el typecheck.
    const compileOnly = () => {
      // @ts-expect-error clave inexistente
      es.t('landing.nope');
      // @ts-expect-error falta el parámetro {code}
      es.t('room.title');
      // @ts-expect-error parámetro con otro nombre
      es.t('room.title', { room: 'X' });
      // @ts-expect-error un plural necesita count numérico
      es.t('lobby.playerCount', { count: 'dos' });
      // @ts-expect-error un texto sin parámetros no recibe parámetros
      es.t('app.title', { x: 1 });
    };
    expect(typeof compileOnly).toBe('function');
  });
});
