import type { ColorGroup } from '@gran-negocio/shared';

/** Colores de cada grupo (los mismos que los tokens `--color-grupo-*` del CSS). */
export const GROUP_COLORS: Readonly<Record<ColorGroup, string>> = {
  brown: '#8b5a2b',
  lightBlue: '#9ed3f0',
  pink: '#d9418c',
  orange: '#f08a24',
  red: '#d7263d',
  yellow: '#f5d000',
  green: '#1e9e5a',
  darkBlue: '#1f4e9e',
};
