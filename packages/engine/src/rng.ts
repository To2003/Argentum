/**
 * PRNG con semilla (mulberry32).
 *
 * El engine nunca usa azar ambiente: cada tirada recibe el estado del
 * generador y devuelve el siguiente, que quien llama tiene que guardar (en
 * M2, `GameState.rngState`). Dados y barajado de mazos salen de acá, así que
 * una partida se reproduce entera a partir del seed y las acciones.
 *
 * El estado nunca sale del server: la PlayerView lo filtra (SPEC.md §3.1).
 */

/** Todo el estado del generador: un entero de 32 bits sin signo. */
export type RngState = number;

export interface Draw<T> {
  readonly value: T;
  readonly state: RngState;
}

const UINT32 = 0x100000000;

export const createRng = (seed: number): RngState => seed >>> 0;

/** Un paso de mulberry32: un float en [0, 1). */
export const nextFloat = (state: RngState): Draw<number> => {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / UINT32, state: nextState };
};

/** Un entero en [0, bound). Un bound no positivo es un bug de quien llama, no una regla del juego. */
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

/** Dos dados, en el orden en que se tiraron. */
export const rollDice = (state: RngState): Draw<readonly [number, number]> => {
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
