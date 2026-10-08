import { isOwnable, tileAt } from '@gran-negocio/shared';
import { legalActions } from '../legal.js';
import type { Action, ActionType, PhaseKind, PlayerId, ReadonlyGameState } from '../types.js';

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

/**
 * Qué prefiere hacer en cada fase, en orden. En `inDebt` es la única vez que
 * vende o hipoteca solo: una deuda que no puede pagar (SPEC.md §8).
 */
const PREFERENCES: Readonly<Record<PhaseKind, readonly ActionType[]>> = {
  waitingRoll: ['rollDice'],
  jailDecision: ['rollDice'],
  awaitingPurchase: ['declineProperty'],
  postRoll: ['endTurn'],
  inDebt: ['payDebt', 'sellBuilding', 'sellAllBuildings', 'mortgage', 'declareBankruptcy'],
  auction: ['passAuction'],
  gameOver: [],
};

export function autopilotAction(
  state: ReadonlyGameState,
  playerId: PlayerId,
  mode: AutopilotMode,
): Action | null {
  const legal = legalActions(state, playerId);
  const { phase } = state;

  // Un trueque que le proponen: lo rechaza.
  if (legal.some((action) => action.type === 'rejectTrade')) return { type: 'rejectTrade' };

  // Desconectado y con resto: compra.
  const buy = legal.find((action) => action.type === 'buyProperty');
  if (mode === 'disconnected' && buy !== undefined && phase.kind === 'awaitingPurchase') {
    const tile = tileAt(phase.tile);
    const cash = state.players[playerId]?.cash ?? 0;
    if (isOwnable(tile) && cash - tile.price >= DISCONNECTED_BUY_RESERVE) return buy;
  }

  for (const type of PREFERENCES[phase.kind]) {
    const action = legal.find((candidate) => candidate.type === type);
    if (action !== undefined) return action;
  }
  return null;
}
