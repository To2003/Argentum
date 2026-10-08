import { RulesConfigSchema, type RulesConfig, type RulesOverrides } from './schemas/rules.js';

/**
 * Reglas oficiales. `useRealBrands` arranca en true; el server lo pisa con la
 * variable de entorno USE_REAL_BRANDS al crear cada sala (shared no lee el
 * entorno: es puro).
 */
export const DEFAULT_RULES: Readonly<RulesConfig> = Object.freeze({
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

/**
 * Aplica cambios sobre una base y valida el resultado entero. Tira un ZodError
 * si algo queda fuera de rango: quien llama (el server) lo traduce a un error
 * de protocolo.
 */
export function resolveRules(
  overrides: RulesOverrides = {},
  base: Readonly<RulesConfig> = DEFAULT_RULES,
): RulesConfig {
  return RulesConfigSchema.parse({ ...base, ...overrides });
}
