import { describe, expect, it } from 'vitest';
import {
  createTranslator,
  isTokenId,
  LOCALES,
  TOKEN_IDS,
  TOKENS,
  tokenColor,
} from '../src/index.js';

describe('fichas (SPEC §7.3)', () => {
  it('son seis, con ids y colores únicos', () => {
    expect(TOKENS).toHaveLength(6);
    expect(new Set(TOKEN_IDS).size).toBe(6);
    expect(new Set(TOKENS.map((t) => t.color)).size).toBe(6);
  });

  it.each(LOCALES)('%s: toda ficha tiene nombre', (locale) => {
    const translator = createTranslator(locale);
    for (const id of TOKEN_IDS) expect(translator.has(`token.${id}`), id).toBe(true);
  });

  it('isTokenId y tokenColor', () => {
    expect(isTokenId('mate')).toBe(true);
    expect(isTokenId('dado')).toBe(false);
    expect(tokenColor('mate')).toBe('#2E7D32');
    expect(tokenColor('dado')).toBe('#607D8B');
  });
});
