import { TILE_COUNT } from '@gran-negocio/shared';

/**
 * Geometría del tablero (SPEC.md §4.1): grilla 11 × 11 con columnas y filas
 * `2fr repeat(9, 1fr) 2fr`. La Salida está abajo a la derecha y se avanza en
 * sentido horario (hacia la izquierda por abajo, hacia arriba por la izquierda…).
 */
export type Side = 'bottom' | 'left' | 'top' | 'right' | 'corner';

export interface Placement {
  /** Fila y columna de la grilla, de 1 a 11. */
  readonly row: number;
  readonly col: number;
  readonly side: Side;
  /**
   * Cuánto se rota el contenido para que la banda de color mire al centro:
   * abajo 0°, izquierda 90°, arriba 180°, derecha 270°.
   */
  readonly rotation: 0 | 90 | 180 | 270;
}

export function placement(index: number): Placement {
  if (!Number.isInteger(index) || index < 0 || index >= TILE_COUNT) {
    throw new RangeError(`no hay casilla ${index}`);
  }
  if (index === 0) return { row: 11, col: 11, side: 'corner', rotation: 0 };
  if (index < 10) return { row: 11, col: 11 - index, side: 'bottom', rotation: 0 };
  if (index === 10) return { row: 11, col: 1, side: 'corner', rotation: 90 };
  if (index < 20) return { row: 11 - (index - 10), col: 1, side: 'left', rotation: 90 };
  if (index === 20) return { row: 1, col: 1, side: 'corner', rotation: 180 };
  if (index < 30) return { row: 1, col: index - 19, side: 'top', rotation: 180 };
  if (index === 30) return { row: 1, col: 11, side: 'corner', rotation: 270 };
  return { row: index - 29, col: 11, side: 'right', rotation: 270 };
}

/** Dónde empieza y cuánto mide cada fila/columna, en unidades de las 13 del tablero. */
const span = (line: number): { start: number; size: number } =>
  line === 1
    ? { start: 0, size: 2 }
    : line === 11
      ? { start: 11, size: 2 }
      : { start: line, size: 1 };

/**
 * El centro de una casilla en % del tablero (para dibujar las fichas encima y
 * animarlas de casilla en casilla). En la Cárcel, los presos van adentro
 * (arriba a la derecha de la esquina) y los de visita en el borde.
 */
export function tileCenter(index: number, inJail = false): { x: number; y: number } {
  const { row, col } = placement(index);
  const r = span(row);
  const c = span(col);
  let x = c.start + c.size / 2;
  let y = r.start + r.size / 2;
  // Hacia el borde exterior, para no tapar el nombre (que está más cerca de la banda).
  const OUTWARD = 0.4;
  const { side } = placement(index);
  if (side === 'bottom' || index === 0) y += OUTWARD;
  else if (side === 'top' || index === 20 || index === 30) y -= OUTWARD;
  else if (side === 'left') x -= OUTWARD;
  else if (side === 'right') x += OUTWARD;
  if (index === 10) {
    x = inJail ? 1.35 : 0.5;
    y = inJail ? 11.65 : 12.4;
  }
  return { x: (x / 13) * 100, y: (y / 13) * 100 };
}
