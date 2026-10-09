import fc from 'fast-check';
import { COLOR_GROUPS, DEFAULT_RULES, GROUP_TILES } from '@gran-negocio/shared';
import { describe, expect, it } from 'vitest';
import type { GameSetup } from '../src/index.js';
import { randomPlay, replay } from './invariants.js';

const hex32 = fc
  .array(fc.integer({ min: 0, max: 15 }), { minLength: 32, maxLength: 32 })
  .map((digits) => digits.map((d) => d.toString(16)).join(''));

const setupArb = fc
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

describe('fuzz de invariantes', () => {
  it('cualquier secuencia de acciones legales mantiene las invariantes', () => {
    fc.assert(
      fc.property(setupArb, hex32, (setup, policySeed) => {
        randomPlay(setup, { steps: 400, policySeed });
      }),
      { numRuns: 80 },
    );
  }, 120_000);
});

describe('fuzz de partida avanzada (construcción y escasez)', () => {
  it('con grupos completos y plata, construir y vender mantiene 32/12 y la construcción pareja', () => {
    fc.assert(
      fc.property(
        setupArb,
        hex32,
        fc.boolean(),
        fc.boolean(),
        (setup, policySeed, evenBuild, scarce) => {
          const rules = { ...setup.rules, evenBuild } as typeof DEFAULT_RULES;
          const { events } = randomPlay(
            { ...setup, rules },
            {
              steps: 300,
              policySeed,
              // Que la partida construya y venda de verdad (es lo que se prueba).
              prefer: ['buildHouse', 'sellBuilding', 'sellAllBuildings'],
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
          return events.some((e) => e.type === 'buildingBuilt');
        },
      ),
      { numRuns: 40 },
    );
  }, 120_000);
});

describe('replay', () => {
  it('seed + acciones reconstruye exactamente el mismo estado y los mismos eventos', () => {
    fc.assert(
      fc.property(setupArb, hex32, (setup, policySeed) => {
        const played = randomPlay(setup, { steps: 300, policySeed });
        const replayed = replay(setup, played.log);
        expect(replayed.state).toEqual(played.state);
        expect(replayed.events).toEqual(played.events);
      }),
      { numRuns: 40 },
    );
  }, 120_000);

  it('otro seed con las mismas acciones da otra partida', () => {
    const setup = fc.sample(setupArb, { numRuns: 1, seed: 7 })[0];
    if (setup === undefined) throw new Error('sin setup');
    const played = randomPlay(setup, { steps: 50, policySeed: '0'.repeat(32) });
    const other = {
      ...setup,
      seed: setup.seed === 'f'.repeat(32) ? '0'.repeat(32) : 'f'.repeat(32),
    };
    const differs = (() => {
      try {
        return JSON.stringify(replay(other, played.log).state) !== JSON.stringify(played.state);
      } catch {
        return true; // con otros dados, alguna acción del log ya no es legal
      }
    })();
    expect(differs).toBe(true);
  });
});
