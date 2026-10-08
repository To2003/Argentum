import { BOARD, COLOR_GROUPS, isOwnable } from '@gran-negocio/shared';
import { minBidFor } from './rules/auction.js';
import type { Action, PlayerId, ReadonlyGameState } from './types.js';
import { validateAction } from './validate.js';

/**
 * Jugadas legales, para resaltar en la UI y para los bots.
 *
 * **Acá no hay reglas.** Se enumeran los candidatos y se filtran con
 * `validateAction`, así que legal acá es legal allá por construcción. Un
 * property test lo fija: si alguien "optimiza" este archivo repitiendo una
 * regla, falla.
 *
 * Lo que tiene parámetros libres no se enumera entero: de las pujas va solo
 * la mínima (cualquier monto entre esa y el efectivo también vale) y los
 * trueques no van (son combinatorios; el modal los valida contra
 * `validateAction` mientras se arman).
 */
const FIXED: readonly Action[] = [
  { type: 'rollDice' },
  { type: 'payJailFine' },
  { type: 'useJailCard' },
  { type: 'buyProperty' },
  { type: 'declineProperty' },
  { type: 'endTurn' },
  { type: 'payDebt' },
  { type: 'declareBankruptcy' },
  { type: 'passAuction' },
  { type: 'acceptTrade' },
  { type: 'rejectTrade' },
  { type: 'cancelTrade' },
];

const OWNABLE = BOARD.filter(isOwnable).map((tile) => tile.index);

const PER_TILE: readonly Action[] = OWNABLE.flatMap((tile) => [
  { type: 'buildHouse', tile } as const,
  { type: 'sellBuilding', tile } as const,
  { type: 'mortgage', tile } as const,
  { type: 'unmortgage', tile } as const,
]);

const PER_GROUP: readonly Action[] = COLOR_GROUPS.map(
  (group) => ({ type: 'sellAllBuildings', group }) as const,
);

/** Todos los candidatos sin parámetros libres (para el fuzz: acciones al azar). */
export const CANDIDATE_ACTIONS: readonly Action[] = [...FIXED, ...PER_TILE, ...PER_GROUP];

export function legalActions(state: ReadonlyGameState, playerId: PlayerId): Action[] {
  const candidates: Action[] = [...CANDIDATE_ACTIONS];
  const min = minBidFor(state, playerId);
  if (min !== null && Number.isFinite(min)) candidates.push({ type: 'bid', amount: min });
  return candidates.filter((action) => validateAction(state, playerId, action) === null);
}
