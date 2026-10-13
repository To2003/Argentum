import fc from 'fast-check';
import {
  COLOR_GROUPS,
  DEFAULT_RULES,
  GROUP_TILES,
  tileAt,
  type ColorGroup,
} from '@gran-negocio/shared';
import type { GameSetup } from '../src/index.js';
import { FuzzFailure, randomPlay, type PlayResult } from './invariants.js';
import { writeCoverage, type Replay } from './fuzzReport.js';

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

// ---------------------------------------------------------------- cobertura

/**
 * Qué llegó a ejercitar cada caso de la partida avanzada. No decide si el test
 * pasa: es para ver que el escenario sigue cubriendo lo que importa.
 */
export const COVERAGE_KEYS = [
  'houses',
  'hotel',
  'soldBuilding',
  'mortgagedBuiltGroup',
  'scarcityAuction',
  'bankruptcy',
] as const;
export type CoverageKey = (typeof COVERAGE_KEYS)[number];

export const COVERAGE_LABELS: Readonly<Record<CoverageKey, string>> = {
  houses: 'construyeron casas',
  hotel: 'llegaron a hotel',
  soldBuilding: 'vendieron edificios',
  mortgagedBuiltGroup: 'hipotecaron un grupo con edificios',
  scarcityAuction: 'subasta por escasez de casas',
  bankruptcy: 'quiebra',
};

/** Cuántos casos llegaron a cada cosa, sobre `cases`. */
export interface CoverageTally {
  cases: number;
  readonly hits: Record<CoverageKey, number>;
}

export const newCoverage = (): CoverageTally => ({
  cases: 0,
  hits: {
    houses: 0,
    hotel: 0,
    soldBuilding: 0,
    mortgagedBuiltGroup: 0,
    scarcityAuction: 0,
    bankruptcy: 0,
  },
});

const groupOf = (tile: number): ColorGroup | null => {
  const found = tileAt(tile);
  return found.kind === 'property' ? found.group : null;
};

/**
 * Qué ejercitó una partida. `initiallyBuilt`: el escenario de escasez arranca
 * con casas en todos los grupos (puestas por `prepare`, sin eventos).
 */
export function coverageOf(
  result: PlayResult,
  initiallyBuilt: boolean,
): Record<CoverageKey, boolean> {
  const built = new Set<ColorGroup>(initiallyBuilt ? COLOR_GROUPS : []);
  const seen: Record<CoverageKey, boolean> = {
    houses: false,
    hotel: false,
    soldBuilding: false,
    mortgagedBuiltGroup: false,
    scarcityAuction: false,
    bankruptcy: false,
  };
  for (const event of result.events) {
    switch (event.type) {
      case 'buildingBuilt': {
        if (event.houses === 5) seen.hotel = true;
        else seen.houses = true;
        const group = groupOf(event.tile);
        if (group !== null) built.add(group);
        break;
      }
      case 'buildingSold':
        seen.soldBuilding = true;
        break;
      case 'propertyMortgaged': {
        const group = groupOf(event.tile);
        if (group !== null && built.has(group)) seen.mortgagedBuiltGroup = true;
        break;
      }
      case 'auctionOpened':
        if (event.lot.kind === 'building') seen.scarcityAuction = true;
        break;
      case 'playerBankrupt':
        seen.bankruptcy = true;
        break;
      default:
        break;
    }
  }
  return seen;
}

export function addCoverage(tally: CoverageTally, seen: Record<CoverageKey, boolean>): void {
  tally.cases += 1;
  for (const key of COVERAGE_KEYS) if (seen[key]) tally.hits[key] += 1;
}

/** "construyeron casas 40/40, llegaron a hotel 12/40, …". */
export const formatCoverage = (tally: CoverageTally): string =>
  COVERAGE_KEYS.map(
    (key) => `${COVERAGE_LABELS[key]} ${String(tally.hits[key])}/${String(tally.cases)}`,
  ).join(', ');

/** Las cosas que ningún caso de la corrida llegó a ejercitar. */
export const coverageGaps = (tally: CoverageTally): CoverageKey[] =>
  COVERAGE_KEYS.filter((key) => tally.hits[key] === 0);

/**
 * La propiedad: las invariantes se chequean en cada paso y tiene que haber
 * construcción. Si se pasa `coverage`, cada caso suma lo que ejercitó.
 */
export const advancedProperty = (coverage?: CoverageTally) =>
  fc.property(...advancedArbs, (setup, policySeed, evenBuild, scarce) => {
    const result = playAdvanced(setup, policySeed, evenBuild, scarce);
    if (coverage !== undefined) addCoverage(coverage, coverageOf(result, scarce));
    return result.events.some((event) => event.type === 'buildingBuilt');
  });

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

/**
 * Cierra una corrida: la imprime, la guarda en test-results y avisa (sin
 * fallar) si algo no se ejercitó en ningún caso.
 */
export function reportCoverage(name: string, tally: CoverageTally): CoverageKey[] {
  const gaps = coverageGaps(tally);
  writeCoverage(name, { property: name, ...tally, gaps });
  console.log(`cobertura (${String(tally.cases)} casos): ${formatCoverage(tally)}`);
  if (gaps.length > 0) {
    console.warn(
      `ADVERTENCIA de cobertura: ningún caso ${gaps.map((key) => COVERAGE_LABELS[key]).join(', ')}`,
    );
  }
  return gaps;
}
