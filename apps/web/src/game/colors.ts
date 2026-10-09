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

/**
 * Un patrón por grupo, encima del color (SPEC.md §7.7: no depender solo del
 * color). Claro sobre los colores oscuros y oscuro sobre los claros.
 */
const INK = 'rgba(20,40,58,0.32)';
const LIGHT = 'rgba(255,255,255,0.5)';
const GROUP_PATTERNS: Readonly<Record<ColorGroup, string>> = {
  brown: 'none',
  lightBlue: `radial-gradient(${INK} 22%, transparent 26%) 0 0 / 6px 6px`,
  pink: `repeating-linear-gradient(0deg, ${LIGHT} 0 2px, transparent 2px 6px)`,
  orange: `repeating-linear-gradient(90deg, ${INK} 0 2px, transparent 2px 6px)`,
  red: `repeating-linear-gradient(45deg, ${LIGHT} 0 2px, transparent 2px 6px)`,
  yellow: `repeating-linear-gradient(-45deg, ${INK} 0 2px, transparent 2px 6px)`,
  green: `repeating-linear-gradient(0deg, ${LIGHT} 0 1.5px, transparent 1.5px 6px), repeating-linear-gradient(90deg, ${LIGHT} 0 1.5px, transparent 1.5px 6px)`,
  darkBlue: `repeating-conic-gradient(${LIGHT} 0 25%, transparent 0 50%) 0 0 / 8px 8px`,
};

/** Color y patrón de un grupo, listos para `style`. */
export const groupSwatch = (group: ColorGroup): { background: string } => ({
  background:
    GROUP_PATTERNS[group] === 'none'
      ? GROUP_COLORS[group]
      : `${GROUP_PATTERNS[group]}, ${GROUP_COLORS[group]}`,
});
