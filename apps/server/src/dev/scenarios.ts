import type { GameState } from '@gran-negocio/engine';

/**
 * Escenarios de desarrollo: partidas armadas a mano para los e2e y para
 * probar a mano un flujo sin depender de los dados (subasta, trueque,
 * construcción). Solo existen fuera de producción y nunca se persisten: su
 * estado no sale de `seed + acciones`.
 *
 * Los jugadores son siempre p1 (Ana) y p2 (Beto), y le toca a p1.
 */
export const SCENARIOS = {
  /** Ana cayó en Puerto Madero sin dueño: comprar o rechazar (y subastar). */
  auction: (state: GameState) => {
    const ana = state.players['p1'];
    if (ana !== undefined) ana.position = 39;
    state.phase = { kind: 'awaitingPurchase', tile: 39 };
  },
  /** Ana tiene los marrones y los celestes completos, antes de tirar. */
  build: (state: GameState) => {
    for (const tile of [1, 3, 6, 8, 9]) {
      state.properties[tile] = { ownerId: 'p1', houses: 0, mortgaged: false };
    }
    state.phase = { kind: 'waitingRoll' };
  },
  /** Cada uno tiene la mitad de un grupo; la de Beto está hipotecada. Ana ya tiró. */
  trade: (state: GameState) => {
    state.properties[1] = { ownerId: 'p1', houses: 0, mortgaged: false };
    state.properties[6] = { ownerId: 'p1', houses: 0, mortgaged: false };
    state.properties[3] = { ownerId: 'p2', houses: 0, mortgaged: true };
    state.properties[8] = { ownerId: 'p2', houses: 0, mortgaged: false };
    state.phase = { kind: 'postRoll' };
  },
} as const satisfies Record<string, (state: GameState) => void>;

export type ScenarioName = keyof typeof SCENARIOS;

export const isScenario = (name: string): name is ScenarioName => Object.hasOwn(SCENARIOS, name);
