import { describe, expect, it } from 'vitest';
import { placement } from '../src/game/boardLayout.js';

describe('geometría del tablero (SPEC §4.1)', () => {
  it('las esquinas', () => {
    expect(placement(0)).toMatchObject({ row: 11, col: 11, side: 'corner' });
    expect(placement(10)).toMatchObject({ row: 11, col: 1, side: 'corner' });
    expect(placement(20)).toMatchObject({ row: 1, col: 1, side: 'corner' });
    expect(placement(30)).toMatchObject({ row: 1, col: 11, side: 'corner' });
  });

  it('sentido horario desde la Salida', () => {
    expect(placement(1)).toMatchObject({ row: 11, col: 10, side: 'bottom', rotation: 0 });
    expect(placement(9)).toMatchObject({ row: 11, col: 2, side: 'bottom' });
    expect(placement(11)).toMatchObject({ row: 10, col: 1, side: 'left', rotation: 90 });
    expect(placement(19)).toMatchObject({ row: 2, col: 1, side: 'left' });
    expect(placement(21)).toMatchObject({ row: 1, col: 2, side: 'top', rotation: 180 });
    expect(placement(29)).toMatchObject({ row: 1, col: 10, side: 'top' });
    expect(placement(31)).toMatchObject({ row: 2, col: 11, side: 'right', rotation: 270 });
    expect(placement(39)).toMatchObject({ row: 10, col: 11, side: 'right' });
  });

  it('las 40 casillas ocupan 40 celdas distintas del borde', () => {
    const cells = new Set(
      Array.from({ length: 40 }, (_, i) => {
        const { row, col } = placement(i);
        expect(row === 1 || row === 11 || col === 1 || col === 11).toBe(true);
        return `${row}:${col}`;
      }),
    );
    expect(cells.size).toBe(40);
  });

  it('rechaza índices fuera del tablero', () => {
    expect(() => placement(40)).toThrow(RangeError);
    expect(() => placement(-1)).toThrow(RangeError);
  });
});

describe('centro de las casillas', () => {
  it('la Salida abajo a la derecha, el descanso arriba a la izquierda', async () => {
    const { tileCenter } = await import('../src/game/boardLayout.js');
    // Corridas hacia el borde exterior (0,4 unidades) para no tapar el nombre.
    expect(tileCenter(0)).toEqual({ x: (12 / 13) * 100, y: (12.4 / 13) * 100 });
    expect(tileCenter(20)).toEqual({ x: (1 / 13) * 100, y: (0.6 / 13) * 100 });
    expect(tileCenter(5).y).toBeCloseTo((12.4 / 13) * 100);
    expect(tileCenter(15).x).toBeCloseTo((0.6 / 13) * 100);
    expect(tileCenter(35).x).toBeCloseTo((12.4 / 13) * 100);
    expect(tileCenter(10, true)).not.toEqual(tileCenter(10, false));
  });
});
