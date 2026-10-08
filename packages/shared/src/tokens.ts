/**
 * Las seis fichas (SPEC.md §7.3), cada una con su color. Únicas por jugador:
 * el lobby no deja elegir una ya tomada. El nombre sale de i18n (`token.<id>`).
 */
export const TOKENS = [
  { id: 'mate', color: '#2E7D32' },
  { id: 'bombo', color: '#C62828' },
  { id: 'alfajor', color: '#6D4C41' },
  { id: 'colectivo', color: '#F9A825' },
  { id: 'hornero', color: '#EF6C00' },
  { id: 'solDeMayo', color: '#1565C0' },
] as const;

export type TokenId = (typeof TOKENS)[number]['id'];

export const TOKEN_IDS: readonly TokenId[] = TOKENS.map((token) => token.id);

export const isTokenId = (value: string): value is TokenId =>
  (TOKEN_IDS as readonly string[]).includes(value);

export const tokenColor = (id: string): string =>
  TOKENS.find((token) => token.id === id)?.color ?? '#607D8B';
