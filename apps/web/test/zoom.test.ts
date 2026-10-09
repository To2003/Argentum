import { describe, expect, it } from 'vitest';
import {
  clampScale,
  distance,
  MAX_SCALE,
  midpoint,
  scrollForZoom,
  settleScale,
} from '../src/game/zoom.js';

describe('zoom del tablero', () => {
  it('la escala queda entre 1 y el máximo', () => {
    expect(clampScale(0.4)).toBe(1);
    expect(clampScale(2)).toBe(2);
    expect(clampScale(10)).toBe(MAX_SCALE);
    expect(clampScale(Number.NaN)).toBe(1);
  });

  it('al soltar, un zoom casi nulo vuelve al tablero entero', () => {
    expect(settleScale(1.05)).toBe(1);
    expect(settleScale(1.5)).toBe(1.5);
    expect(settleScale(5)).toBe(MAX_SCALE);
  });

  it('el punto entre los dedos queda quieto', () => {
    const scroll = { x: 100, y: 50 };
    const focal = { x: 200, y: 150 };
    const next = scrollForZoom(scroll, focal, 1.5, 3);
    // Coordenada del contenido bajo el foco, antes y después, en unidades de escala 1.
    expect((next.x + focal.x) / 3).toBeCloseTo((scroll.x + focal.x) / 1.5);
    expect((next.y + focal.y) / 3).toBeCloseTo((scroll.y + focal.y) / 1.5);
    // Alejar hasta 1 desde el borde no deja scroll negativo.
    expect(scrollForZoom({ x: 0, y: 0 }, { x: 300, y: 300 }, 2, 1)).toEqual({ x: 0, y: 0 });
  });

  it('distancia y punto medio de dos dedos', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(midpoint({ x: 0, y: 10 }, { x: 4, y: 20 })).toEqual({ x: 2, y: 15 });
  });
});
