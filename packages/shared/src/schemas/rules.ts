import { z } from 'zod';
import { MAX_PLAYERS, MIN_PLAYERS } from '../constants.js';

/**
 * Reglas configurables por sala (SPEC.md §5.9). Los valores por defecto son
 * las reglas oficiales; todo lo que se aparta de ellas arranca apagado.
 */
export const RulesConfigSchema = z.strictObject({
  startingCash: z.int().min(500).max(10_000),
  /** Lo que se cobra al pasar o caer en la Salida. */
  salary: z.int().min(0).max(1_000),
  jailFine: z.int().min(0).max(500),
  /** Intentos de sacar dobles antes de tener que pagar la fianza. */
  maxJailTurns: z.int().min(1).max(5),
  /** Regla de la casa: impuestos y multas van a un pozo que se lleva quien cae en el descanso. */
  freeParkingPot: z.boolean(),
  /** Si nadie compra al precio de lista, se subasta. */
  auctionOnDecline: z.boolean(),
  /** Construcción y venta parejas dentro de un grupo. */
  evenBuild: z.boolean(),
  /** Alquiler base ×2 con el grupo completo y sin construir. */
  doubleRentOnMonopoly: z.boolean(),
  /** 0 = sin límite de tiempo por turno. */
  turnTimerSeconds: z.union([z.literal(0), z.int().min(15).max(600)]),
  auctionStartBid: z.int().min(1).max(500),
  /** Segundos sin una puja nueva para que la subasta se cierre. */
  auctionBidSeconds: z.int().min(3).max(60),
  maxPlayers: z.int().min(MIN_PLAYERS).max(MAX_PLAYERS),
  /** Partida corta por tiempo (SPEC.md §5.8); null = sin límite. */
  gameDurationMinutes: z.union([z.literal(30), z.literal(60), z.literal(90), z.null()]),
  /** Partida corta por rondas (SPEC.md §5.8); null = sin límite. */
  maxRounds: z.union([z.int().min(5).max(500), z.null()]),
  /** false = las empresas reales (Edenor, AySA) se muestran con nombre genérico. */
  useRealBrands: z.boolean(),
});

export type RulesConfig = z.infer<typeof RulesConfigSchema>;

/** Lo que el host puede cambiar al armar la sala: cualquier subconjunto. */
export const RulesOverridesSchema = RulesConfigSchema.partial();
export type RulesOverrides = z.infer<typeof RulesOverridesSchema>;
