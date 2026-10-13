import fc from 'fast-check';
import { COLOR_GROUPS, DEFAULT_RULES, GROUP_TILES } from '@gran-negocio/shared';
import type { GameSetup } from '../src/index.js';
import { FuzzFailure, randomPlay, type PlayResult } from './invariants.js';
import type { Replay } from './fuzzReport.js';

/**
 * Los escenarios del fuzz, compartidos por `fuzz.test.ts` y el loop
 * (`pnpm fuzz:loop`): los mismos arbitrarios y la misma partida.
 */
export const hex32 = fc
  .array(fc.integer({ min: 0, max: 15 }), { minLength: 32, maxLength: 32 })
  .map((digits) => digits.map((d) => d.toString(16)).join(''));

export const setupArb = fc
  .record({
    seed: hex32,
    players: fc.integer({ min: 2, max: 6 }),
    freeParkingPot: fc.boolean(),
    doubleRentOnMonopoly: fc.boolean(),
    startingCash: fc.constantFrom(500, 1500),
  })
  .map(({ seed, players, ...rules }): GameSetup => ({
    seed,
    rules: { ...DEFAULT_RULES, ...rules },
    players: Array.from({ length: players }, (_, i) => ({
      id: `p${i + 1}`,
      name: `J${i + 1}`,
      tokenId: `t${i + 1}`,
    })),
  }));

/** Vuelve a jugar un caso y devuelve sus acciones y, si falló, dónde y por qué. */
export function replayOf(
  play: () => PlayResult,
  check?: (result: PlayResult) => string | null,
): Replay {
  try {
    const result = play();
    return { actions: result.log, failedAtStep: null, error: check?.(result) ?? null };
  } catch (error) {
    if (error instanceof FuzzFailure) {
      return { actions: error.log, failedAtStep: error.step, error: error.message };
    }
    return { actions: [], failedAtStep: null, error: String(error) };
  }
}

// ---------------------------------------------------------------- partida avanzada

export const ADVANCED_NAME =
  'con grupos completos y plata, construir y vender mantiene 32/12 y la construcción pareja';

export const advancedArbs = [setupArb, hex32, fc.boolean(), fc.boolean()] as const;

/**
 * Todos los grupos repartidos, $3000 cada uno y, con `scarce`, 30 casas ya
 * construidas (quedan 2 en el banco). Hasta la primera construcción, la
 * política construye apenas puede; después elige al azar.
 */
export function playAdvanced(
  setup: GameSetup,
  policySeed: string,
  evenBuild: boolean,
  scarce: boolean,
): PlayResult {
  const rules = { ...DEFAULT_RULES, ...setup.rules, evenBuild };
  return randomPlay(
    { ...setup, rules },
    {
      steps: 300,
      policySeed,
      // Construir apenas se pueda hasta la primera construcción; después, al azar.
      buildFirst: true,
      prepare: (state) => {
        const ids = Object.keys(state.players);
        COLOR_GROUPS.forEach((group, i) => {
          const ownerId = ids[i % ids.length] ?? 'p1';
          for (const tile of GROUP_TILES[group]) {
            state.properties[tile] = { ownerId, houses: 0, mortgaged: false };
          }
        });
        for (const player of Object.values(state.players)) player.cash = 3000;
        if (scarce) {
          // 30 casas ya construidas, de a una por nivel: siempre parejas.
          // Quedan 2 en el banco: la última casa se disputa enseguida.
          const tiles = COLOR_GROUPS.flatMap((group) => GROUP_TILES[group]);
          for (let placed = 0; placed < 30; placed += 1) {
            const property = state.properties[tiles[placed % tiles.length] ?? 1];
            if (property !== undefined) property.houses = (property.houses + 1) as 1 | 2;
          }
          state.bank.houses = 2;
        }
      },
    },
  );
}

/** La propiedad: las invariantes se chequean en cada paso y tiene que haber construcción. */
export const advancedProperty = () =>
  fc.property(...advancedArbs, (setup, policySeed, evenBuild, scarce) =>
    playAdvanced(setup, policySeed, evenBuild, scarce).events.some(
      (event) => event.type === 'buildingBuilt',
    ),
  );

export const replayAdvanced = (
  setup: GameSetup,
  policySeed: string,
  evenBuild: boolean,
  scarce: boolean,
): Replay =>
  replayOf(
    () => playAdvanced(setup, policySeed, evenBuild, scarce),
    (result) =>
      result.events.some((event) => event.type === 'buildingBuilt')
        ? null
        : 'la partida no construyó nada (la propiedad devolvió false)',
  );
