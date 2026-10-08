/**
 * PRNG con semilla: sfc32, con 128 bits de estado (ADR 0006).
 *
 * El engine nunca usa azar ambiente: cada tirada recibe el estado del
 * generador y devuelve el siguiente, que vive en `GameState.rngState`. Dados
 * y barajado de mazos salen de acá, así que una partida se reproduce entera a
 * partir del seed y las acciones.
 *
 * El estado nunca sale del server: la PlayerView lo filtra (SPEC.md §3.1).
 * No es un generador criptográfico: el secreto es el estado, no el algoritmo.
 */

/** Cuatro enteros de 32 bits sin signo: a, b, c y el contador d. */
export type RngState = readonly [number, number, number, number];

/** 128 bits en hexadecimal (32 caracteres). El server lo genera con `crypto`. */
export type Seed = string;

export interface Draw<T> {
  readonly value: T;
  readonly state: RngState;
}

const UINT32 = 0x100000000;
const SEED_PATTERN = /^[0-9a-f]{32}$/;

/**
 * Rondas que se descartan al sembrar. Mezclan las cuatro palabras entre sí,
 * así un seed con estructura (ceros, contadores) no se nota en las primeras
 * tiradas. 12 es lo que recomienda el autor de sfc32; 15 deja margen.
 */
const WARM_UP_ROUNDS = 15;

export const isSeed = (value: string): value is Seed => SEED_PATTERN.test(value);

/** Un paso de sfc32: un uint32 y el estado siguiente. */
const step = (state: RngState): Draw<number> => {
  const [a, b, c, d] = state;
  const t = (((a + b) | 0) + d) | 0;
  const nextC = ((c << 21) | (c >>> 11)) + t;
  return {
    value: t >>> 0,
    state: [(b ^ (b >>> 9)) >>> 0, (c + (c << 3)) >>> 0, nextC >>> 0, (d + 1) >>> 0],
  };
};

export const createRng = (seed: Seed): RngState => {
  if (!isSeed(seed))
    throw new RangeError(`seed must be 32 lowercase hex chars, got ${JSON.stringify(seed)}`);
  let state: RngState = [
    Number.parseInt(seed.slice(0, 8), 16),
    Number.parseInt(seed.slice(8, 16), 16),
    Number.parseInt(seed.slice(16, 24), 16),
    Number.parseInt(seed.slice(24, 32), 16),
  ];
  for (let i = 0; i < WARM_UP_ROUNDS; i += 1) state = step(state).state;
  return state;
};

/** Un float en [0, 1). */
export const nextFloat = (state: RngState): Draw<number> => {
  const draw = step(state);
  return { value: draw.value / UINT32, state: draw.state };
};

/**
 * Un entero en [0, bound). Un bound no positivo es un bug de quien llama, no
 * una regla del juego. El sesgo de escalar un uint32 es de bound / 2^32: con
 * bounds de 6 o 40 no se puede medir.
 */
export const nextInt = (state: RngState, bound: number): Draw<number> => {
  if (!Number.isInteger(bound) || bound <= 0) {
    throw new RangeError(`bound must be a positive integer, got ${bound}`);
  }
  const draw = nextFloat(state);
  return { value: Math.floor(draw.value * bound), state: draw.state };
};

/** Una cara de dado en [1, 6]. */
export const rollDie = (state: RngState): Draw<number> => {
  const draw = nextInt(state, 6);
  return { value: draw.value + 1, state: draw.state };
};

export type Dice = readonly [number, number];

/** Dos dados, en el orden en que se tiraron. */
export const rollDice = (state: RngState): Draw<Dice> => {
  const first = rollDie(state);
  const second = rollDie(first.state);
  return { value: [first.value, second.value], state: second.state };
};

/** Fisher-Yates sobre una copia: el arreglo de entrada no se toca. */
export const shuffle = <T>(state: RngState, items: readonly T[]): Draw<T[]> => {
  const result = [...items];
  let current = state;
  for (let i = result.length - 1; i > 0; i -= 1) {
    const draw = nextInt(current, i + 1);
    current = draw.state;
    const j = draw.value;
    // Los casts son seguros por construcción: los dos índices están en rango.
    const tmp = result[i] as T;
    result[i] = result[j] as T;
    result[j] = tmp;
  }
  return { value: result, state: current };
};
