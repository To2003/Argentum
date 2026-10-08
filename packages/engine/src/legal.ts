import type { Action, PlayerId, ReadonlyGameState } from './types.js';
import { validateAction } from './validate.js';

/**
 * Jugadas legales, para resaltar en la UI y para los bots.
 *
 * **Acá no hay reglas.** Se enumeran los candidatos y se filtran con
 * `validateAction`, así que legal acá es legal allá por construcción. Un
 * property test lo fija: si alguien "optimiza" este archivo repitiendo una
 * regla, falla.
 */
export const CANDIDATE_ACTIONS: readonly Action[] = [
  { type: 'rollDice' },
  { type: 'payJailFine' },
  { type: 'useJailCard' },
  { type: 'buyProperty' },
  { type: 'declineProperty' },
  { type: 'endTurn' },
  { type: 'declareBankruptcy' },
];

export const legalActions = (state: ReadonlyGameState, playerId: PlayerId): Action[] =>
  CANDIDATE_ACTIONS.filter((action) => validateAction(state, playerId, action) === null);
