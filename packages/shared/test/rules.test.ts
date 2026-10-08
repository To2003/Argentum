import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES,
  resolveRules,
  RulesConfigSchema,
  RulesOverridesSchema,
} from '../src/index.js';

describe('RulesConfig', () => {
  it('los valores por defecto son las reglas oficiales (SPEC.md §5.9)', () => {
    expect(DEFAULT_RULES).toEqual({
      startingCash: 1500,
      salary: 200,
      jailFine: 50,
      maxJailTurns: 3,
      freeParkingPot: false,
      auctionOnDecline: true,
      evenBuild: true,
      doubleRentOnMonopoly: true,
      turnTimerSeconds: 60,
      auctionStartBid: 10,
      auctionBidSeconds: 10,
      maxPlayers: 6,
      gameDurationMinutes: null,
      maxRounds: null,
      useRealBrands: true,
    });
    expect(RulesConfigSchema.safeParse(DEFAULT_RULES).success).toBe(true);
  });

  it('DEFAULT_RULES no se puede mutar', () => {
    expect(Object.isFrozen(DEFAULT_RULES)).toBe(true);
  });

  it('resolveRules aplica cambios sin tocar la base', () => {
    const rules = resolveRules({ useRealBrands: false, freeParkingPot: true, maxRounds: 50 });
    expect(rules).toMatchObject({
      useRealBrands: false,
      freeParkingPot: true,
      maxRounds: 50,
      salary: 200,
    });
    expect(DEFAULT_RULES.useRealBrands).toBe(true);
  });

  it('resolveRules usa la base que le pasen (el default del server)', () => {
    const serverDefaults = resolveRules({ useRealBrands: false });
    expect(resolveRules({}, serverDefaults).useRealBrands).toBe(false);
    expect(resolveRules({ useRealBrands: true }, serverDefaults).useRealBrands).toBe(true);
  });

  it.each([
    { maxPlayers: 1 },
    { maxPlayers: 7 },
    { startingCash: 1500.5 },
    { turnTimerSeconds: 5 },
    { gameDurationMinutes: 45 },
    { auctionStartBid: 0 },
  ])('rechaza valores fuera de rango: %o', (overrides) => {
    expect(() => resolveRules(overrides as never)).toThrow();
  });

  it('acepta turnTimerSeconds = 0 (sin timer)', () => {
    expect(resolveRules({ turnTimerSeconds: 0 }).turnTimerSeconds).toBe(0);
  });

  it('los overrides rechazan claves desconocidas', () => {
    expect(RulesOverridesSchema.safeParse({ salary: 300 }).success).toBe(true);
    expect(RulesOverridesSchema.safeParse({ startingMoney: 2000 }).success).toBe(false);
  });
});
