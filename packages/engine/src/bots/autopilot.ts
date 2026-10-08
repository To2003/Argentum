import { isOwnable, tileAt } from '@gran-negocio/shared';
import { legalActions } from '../legal.js';
import type { Action, PlayerId, ReadonlyGameState } from '../types.js';
import { actorOf } from '../validate.js';

/**
 * Piloto automático (SPEC.md §8): lo que el server hace por un jugador cuando
 * se le vence el timer del turno (`timeout`) o cuando sigue desconectado
 * después del período de gracia (`disconnected`).
 *
 * Es conservador a propósito: nunca vende ni hipoteca salvo en una deuda que
 * no puede pagar, nunca propone ni acepta trueques y nunca puja. Con
 * `disconnected` compra solo si le sobra al menos `DISCONNECTED_BUY_RESERVE`.
 *
 * Devuelve null si ese jugador no tiene nada que hacer ahora.
 */
export type AutopilotMode = 'timeout' | 'disconnected';

/** Efectivo que el piloto de un desconectado se guarda después de comprar. */
export const DISCONNECTED_BUY_RESERVE = 500;

const has = (legal: readonly Action[], type: Action['type']): Action | undefined =>
  legal.find((action) => action.type === type);

export function autopilotAction(
  state: ReadonlyGameState,
  playerId: PlayerId,
  mode: AutopilotMode,
): Action | null {
  const legal = legalActions(state, playerId);
  if (legal.length === 0) return null;
  const { phase } = state;

  // Un trueque que le proponen: lo rechaza.
  if (state.trade?.to === playerId && phase.kind !== 'auction') {
    return { type: 'rejectTrade' };
  }

  switch (phase.kind) {
    case 'auction':
      return has(legal, 'passAuction') ?? null;
    case 'awaitingPurchase': {
      if (actorOf(state) !== playerId) return null;
      const tile = tileAt(phase.tile);
      const price = isOwnable(tile) ? tile.price : Infinity;
      const cash = state.players[playerId]?.cash ?? 0;
      if (mode === 'disconnected' && cash - price >= DISCONNECTED_BUY_RESERVE) {
        return has(legal, 'buyProperty') ?? { type: 'declineProperty' };
      }
      return { type: 'declineProperty' };
    }
    case 'inDebt':
      // Deuda crítica: la única situación en que vende o hipoteca solo.
      return (
        has(legal, 'payDebt') ??
        has(legal, 'sellBuilding') ??
        has(legal, 'sellAllBuildings') ??
        has(legal, 'mortgage') ??
        has(legal, 'declareBankruptcy') ??
        null
      );
    case 'waitingRoll':
    case 'jailDecision':
      return has(legal, 'rollDice') ?? null;
    case 'postRoll':
      return has(legal, 'endTurn') ?? null;
    case 'gameOver':
      return null;
  }
}
