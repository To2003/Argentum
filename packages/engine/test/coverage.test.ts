import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameEvent } from '../src/index.js';
import {
  addCoverage,
  coverageGaps,
  coverageOf,
  formatCoverage,
  newCoverage,
  reportCoverage,
} from './scenarios.js';
import { REPORT_DIR } from './fuzzReport.js';
import type { PlayResult } from './invariants.js';

/** Una partida falsa: solo importan los eventos. */
const played = (events: GameEvent[]): PlayResult => ({
  state: {} as PlayResult['state'],
  log: [],
  events,
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(`${REPORT_DIR}fuzz-coverage-prueba-de-cobertura.json`, { force: true });
});

describe('cobertura del fuzz de partida avanzada', () => {
  it('reconoce cada cosa que puede ejercitar una partida', () => {
    const seen = coverageOf(
      played([
        { type: 'buildingBuilt', playerId: 'p1', tile: 1, houses: 1 },
        { type: 'buildingBuilt', playerId: 'p1', tile: 3, houses: 5 },
        { type: 'buildingSold', playerId: 'p1', tile: 3, houses: 4 },
        { type: 'propertyMortgaged', playerId: 'p1', tile: 1 },
        {
          type: 'auctionOpened',
          lot: { kind: 'building', tile: 6, building: 'house', initiator: 'p1' },
          participants: ['p1', 'p2'],
          minBid: 50,
        },
        { type: 'playerBankrupt', playerId: 'p2', creditor: 'bank' },
      ]),
      false,
    );
    expect(Object.values(seen).every(Boolean)).toBe(true);
  });

  it('hipotecar cuenta solo si el grupo tuvo edificios en la partida (o arrancó con casas)', () => {
    const mortgage: GameEvent = { type: 'propertyMortgaged', playerId: 'p1', tile: 39 };
    expect(coverageOf(played([mortgage]), false).mortgagedBuiltGroup).toBe(false);
    expect(coverageOf(played([mortgage]), true).mortgagedBuiltGroup).toBe(true);
    // Edificios en otro grupo no cuentan.
    expect(
      coverageOf(
        played([{ type: 'buildingBuilt', playerId: 'p1', tile: 1, houses: 1 }, mortgage]),
        false,
      ).mortgagedBuiltGroup,
    ).toBe(false);
  });

  it('una categoría en cero se avisa sin fallar, y la corrida queda en test-results', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const tally = newCoverage();
    addCoverage(
      tally,
      coverageOf(played([{ type: 'buildingBuilt', playerId: 'p1', tile: 1, houses: 1 }]), false),
    );
    expect(formatCoverage(tally)).toContain('construyeron casas 1/1');
    expect(coverageGaps(tally)).toContain('hotel');
    const gaps = reportCoverage('prueba de cobertura', tally);
    expect(gaps).toEqual(coverageGaps(tally));
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/^ADVERTENCIA de cobertura: .*llegaron a hotel/),
    );
  });
});
