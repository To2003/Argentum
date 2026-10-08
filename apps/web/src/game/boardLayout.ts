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
