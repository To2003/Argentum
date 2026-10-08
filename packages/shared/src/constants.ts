/** Versión del protocolo cliente-servidor. Sube cuando un cambio rompe la compatibilidad. */
export const PROTOCOL_VERSION = 1;

/** Cantidad de casillas del tablero (SPEC.md §4.1). */
export const TILE_COUNT = 40;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

/** Índices fijos del tablero (los tests verifican que board.json coincida). */
export const GO_INDEX = 0;
export const JAIL_INDEX = 10;
export const GO_TO_JAIL_INDEX = 30;

/** Edificios del banco (SPEC.md §5.1): la escasez es parte de la estrategia. */
export const BANK_HOUSES = 32;
export const BANK_HOTELS = 12;

/** Casas antes del hotel; `houses = 5` representa el hotel. */
export const HOUSES_PER_HOTEL = 4;

/** Interés para levantar una hipoteca o recibir una hipotecada, en por ciento (SPEC.md §5.5). */
export const MORTGAGE_INTEREST_PERCENT = 10;

/** Venta de edificios al banco: porcentaje del costo (SPEC.md §5.4). */
export const BUILDING_RESALE_PERCENT = 50;

/** Grupos de color, de los baratos a los caros (SPEC.md §4.2). */
export const COLOR_GROUPS = [
  'brown',
  'lightBlue',
  'pink',
  'orange',
  'red',
  'yellow',
  'green',
  'darkBlue',
] as const;
