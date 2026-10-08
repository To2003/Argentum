import { describe, expect, it } from 'vitest';
import boardJson from '../data/board.json' with { type: 'json' };
import {
  BOARD,
  BoardSchema,
  GO_INDEX,
  GO_TO_JAIL_INDEX,
  GROUP_TILES,
  JAIL_INDEX,
  SUBWAY_TILES,
  UTILITY_TILES,
  isOwnable,
  tileAt,
  type ColorGroup,
  type TileKind,
} from '../src/index.js';

const indicesOfKind = (kind: TileKind) =>
  BOARD.filter((tile) => tile.kind === kind).map((tile) => tile.index);

/**
 * SPEC.md §4.2 y §4.3, transcripto a mano a propósito: si alguien toca
 * board.json, este test tiene que discrepar.
 * [índice, id, grupo, precio, costo de casa, alquileres]
 */
const PROPERTIES: readonly (readonly [number, string, ColorGroup, number, number, number[]])[] = [
  [1, 'caminito', 'brown', 60, 50, [2, 10, 30, 90, 160, 250]],
  [3, 'sanTelmo', 'brown', 60, 50, [4, 20, 60, 180, 320, 450]],
  [6, 'recoleta', 'lightBlue', 100, 50, [6, 30, 90, 270, 400, 550]],
  [8, 'rosedal', 'lightBlue', 100, 50, [6, 30, 90, 270, 400, 550]],
  [9, 'teatroColon', 'lightBlue', 120, 50, [8, 40, 100, 300, 450, 600]],
  [11, 'tigre', 'pink', 140, 100, [10, 50, 150, 450, 625, 750]],
  [13, 'laPlata', 'pink', 140, 100, [10, 50, 150, 450, 625, 750]],
  [14, 'marDelPlata', 'pink', 160, 100, [12, 60, 180, 500, 700, 900]],
  [16, 'monumentoBandera', 'orange', 180, 100, [14, 70, 200, 550, 750, 950]],
  [18, 'ibera', 'orange', 180, 100, [14, 70, 200, 550, 750, 950]],
  [19, 'iguazu', 'orange', 200, 100, [16, 80, 220, 600, 800, 1000]],
  [21, 'carlosPaz', 'red', 220, 150, [18, 90, 250, 700, 875, 1050]],
  [23, 'cumbrecita', 'red', 220, 150, [18, 90, 250, 700, 875, 1050]],
  [24, 'altaGracia', 'red', 240, 150, [20, 100, 300, 750, 925, 1100]],
  [26, 'cafayate', 'yellow', 260, 150, [22, 110, 330, 800, 975, 1150]],
  [27, 'humahuaca', 'yellow', 260, 150, [22, 110, 330, 800, 975, 1150]],
  [29, 'aconcagua', 'yellow', 280, 150, [24, 120, 360, 850, 1025, 1200]],
  [31, 'peritoMoreno', 'green', 300, 200, [26, 130, 390, 900, 1100, 1275]],
  [32, 'bariloche', 'green', 300, 200, [26, 130, 390, 900, 1100, 1275]],
  [34, 'ushuaia', 'green', 320, 200, [28, 150, 450, 1000, 1200, 1400]],
  [37, 'obelisco', 'darkBlue', 350, 200, [35, 175, 500, 1100, 1300, 1500]],
  [39, 'puertoMadero', 'darkBlue', 400, 200, [50, 200, 600, 1400, 1700, 2000]],
];

describe('board.json', () => {
  it('tiene 40 casillas en orden', () => {
    expect(BOARD).toHaveLength(40);
    BOARD.forEach((tile, position) => {
      expect(tile.index).toBe(position);
    });
  });

  it('tiene la composición del clásico', () => {
    expect(indicesOfKind('property')).toHaveLength(22);
    expect(indicesOfKind('subway')).toEqual([5, 15, 25, 35]);
    expect(indicesOfKind('utility')).toEqual([12, 28]);
    expect(indicesOfKind('tax')).toEqual([4, 38]);
    expect(indicesOfKind('chance')).toEqual([7, 22, 36]);
    expect(indicesOfKind('community')).toEqual([2, 17, 33]);
    expect(indicesOfKind('go')).toEqual([GO_INDEX]);
    expect(indicesOfKind('jail')).toEqual([JAIL_INDEX]);
    expect(indicesOfKind('freeRest')).toEqual([20]);
    expect(indicesOfKind('goToJail')).toEqual([GO_TO_JAIL_INDEX]);
  });

  it.each(PROPERTIES)(
    'propiedad %i (%s) coincide con el SPEC',
    (index, id, group, price, house, rent) => {
      expect(tileAt(index)).toMatchObject({
        kind: 'property',
        id,
        group,
        price,
        houseCost: house,
        rent,
      });
    },
  );

  it('las propiedades del SPEC son todas las que hay', () => {
    expect(indicesOfKind('property')).toEqual(PROPERTIES.map(([index]) => index));
  });

  it('subtes, servicios e impuestos tienen los valores clásicos', () => {
    for (const index of SUBWAY_TILES) {
      expect(tileAt(index)).toMatchObject({ price: 200, mortgage: 100, rent: [25, 50, 100, 200] });
    }
    for (const index of UTILITY_TILES) {
      expect(tileAt(index)).toMatchObject({ price: 150, mortgage: 75, multipliers: [4, 10] });
    }
    expect(tileAt(4)).toMatchObject({ id: 'incomeTax', amount: 200 });
    expect(tileAt(38)).toMatchObject({ id: 'luxuryTax', amount: 100 });
  });

  it('la hipoteca es el 50 % del precio', () => {
    for (const tile of BOARD.filter(isOwnable)) {
      expect(tile.mortgage * 2).toBe(tile.price);
    }
  });

  it('los grupos tienen 2 o 3 propiedades con el mismo costo de casa', () => {
    expect(
      Object.fromEntries(Object.entries(GROUP_TILES).map(([g, tiles]) => [g, tiles.length])),
    ).toEqual({
      brown: 2,
      lightBlue: 3,
      pink: 3,
      orange: 3,
      red: 3,
      yellow: 3,
      green: 3,
      darkBlue: 2,
    });
    for (const tiles of Object.values(GROUP_TILES)) {
      const costs = new Set(
        tiles.map((index) => {
          const tile = tileAt(index);
          return tile.kind === 'property' ? tile.houseCost : -1;
        }),
      );
      expect(costs.size).toBe(1);
    }
  });

  it('el precio nunca baja a lo largo del tablero (barato → caro)', () => {
    const prices = PROPERTIES.map(([, , , price]) => price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('solo Edenor y AySA son marcas', () => {
    expect(BOARD.filter((tile) => tile.brand === true).map((tile) => tile.id)).toEqual([
      'edenor',
      'aysa',
    ]);
  });

  it('coincide con el snapshot', () => {
    expect(BOARD).toMatchSnapshot();
  });

  it('tileAt rechaza índices fuera del tablero', () => {
    expect(() => tileAt(40)).toThrow(RangeError);
    expect(() => tileAt(-1)).toThrow(RangeError);
  });
});

describe('BoardSchema', () => {
  const clone = () => JSON.parse(JSON.stringify(boardJson)) as { tiles: Record<string, unknown>[] };

  it('acepta el tablero real', () => {
    expect(BoardSchema.safeParse(boardJson).success).toBe(true);
  });

  it('rechaza un tablero incompleto', () => {
    const board = clone();
    board.tiles.pop();
    expect(BoardSchema.safeParse(board).success).toBe(false);
  });

  it('rechaza casillas fuera de orden', () => {
    const board = clone();
    const [first, second] = board.tiles;
    board.tiles[0] = second as Record<string, unknown>;
    board.tiles[1] = first as Record<string, unknown>;
    expect(BoardSchema.safeParse(board).success).toBe(false);
  });

  it('rechaza ids repetidos', () => {
    const board = clone();
    (board.tiles[3] as Record<string, unknown>)['id'] = 'caminito';
    expect(BoardSchema.safeParse(board).success).toBe(false);
  });

  it('rechaza campos desconocidos y alquileres incompletos', () => {
    const extra = clone();
    (extra.tiles[1] as Record<string, unknown>)['color'] = '#795548';
    expect(BoardSchema.safeParse(extra).success).toBe(false);

    const shortRent = clone();
    (shortRent.tiles[1] as Record<string, unknown>)['rent'] = [2, 10, 30];
    expect(BoardSchema.safeParse(shortRent).success).toBe(false);
  });
});

describe('validateGameData', () => {
  it('acepta los datos reales', async () => {
    const { validateGameData } = await import('../src/index.js');
    expect(() => {
      validateGameData();
    }).not.toThrow();
  });
});
