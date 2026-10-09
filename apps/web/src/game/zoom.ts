/**
 * Matemática del zoom del tablero (SPEC.md §4.1, §7.7). Pura, para testearla
 * sin DOM.
 *
 * El zoom cambia el ancho de layout del tablero (no un `transform`): así la
 * container query que oculta los nombres en tableros chicos ve el tamaño real
 * y los nombres aparecen al acercarse.
 */
export const MIN_SCALE = 1;
export const MAX_SCALE = 3;
/** "Acercar a mi ficha". */
export const FOCUS_SCALE = 2.2;
/** Por debajo de esto, al soltar se vuelve al tablero entero. */
const SNAP_TO_FIT = 1.08;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export const clampScale = (scale: number): number =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number.isFinite(scale) ? scale : MIN_SCALE));

/** Al terminar el gesto: un zoom casi nulo vuelve a 1 (sin scroll residual). */
export const settleScale = (scale: number): number =>
  scale < SNAP_TO_FIT ? MIN_SCALE : clampScale(scale);

export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

export const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * El scroll que deja quieto el punto `focal` (relativo a la ventana del
 * tablero) al pasar de `from` a `to`: lo que estaba bajo los dedos sigue ahí.
 */
export function scrollForZoom(scroll: Point, focal: Point, from: number, to: number): Point {
  const ratio = to / from;
  return {
    x: Math.max(0, (scroll.x + focal.x) * ratio - focal.x),
    y: Math.max(0, (scroll.y + focal.y) * ratio - focal.y),
  };
}
