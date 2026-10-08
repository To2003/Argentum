import { GROUP_TILES, tileAt, type OwnableTile } from '@gran-negocio/shared';
import type { DeepReadonly, GameState, PlayerId, TileIndex } from '../types.js';

/** Modificadores de las cartas "Avanzá hasta el … más cercano". */
export type NearestModifier =
  | { readonly target: 'subway'; readonly rentMultiplier: number }
  | { readonly target: 'utility'; readonly diceMultiplier: number };

const countOwnedOfKind = (
  state: DeepReadonly<GameState>,
  ownerId: PlayerId,
  kind: 'subway' | 'utility',
): number =>
  Object.entries(state.properties).filter(
    // Las hipotecadas cuentan para el multiplicador (SPEC.md §15.4).
    ([index, owned]) => owned.ownerId === ownerId && tileAt(Number(index)).kind === kind,
  ).length;

/** El dueño tiene todo el grupo (aunque alguna esté hipotecada, SPEC.md §15.4). */
export const ownsWholeGroup = (
  state: DeepReadonly<GameState>,
  ownerId: PlayerId,
  tile: OwnableTile,
): boolean =>
  tile.kind === 'property' &&
  GROUP_TILES[tile.group].every((index) => state.properties[index]?.ownerId === ownerId);

/**
 * El alquiler que debe quien cae en `tileIndex`. 0 si no tiene dueño o está
 * hipotecada. `diceTotal` es la tirada que cuenta para los servicios: la del
 * movimiento o, con la carta, la tirada nueva.
 */
export function rentFor(
  state: DeepReadonly<GameState>,
  tileIndex: TileIndex,
  diceTotal: number,
  modifier?: NearestModifier,
): number {
  const owned = state.properties[tileIndex];
  if (owned === undefined || owned.mortgaged) return 0;
  const tile = tileAt(tileIndex);
  switch (tile.kind) {
    case 'property': {
      if (owned.houses > 0) return tile.rent[owned.houses];
      const double = state.rules.doubleRentOnMonopoly && ownsWholeGroup(state, owned.ownerId, tile);
      return tile.rent[0] * (double ? 2 : 1);
    }
    case 'subway': {
      const count = countOwnedOfKind(state, owned.ownerId, 'subway');
      const base = tile.rent[count - 1] ?? 0;
      return base * (modifier?.target === 'subway' ? modifier.rentMultiplier : 1);
    }
    case 'utility': {
      const count = countOwnedOfKind(state, owned.ownerId, 'utility');
      const multiplier =
        modifier?.target === 'utility'
          ? modifier.diceMultiplier
          : (tile.multipliers[count - 1] ?? 0);
      return multiplier * diceTotal;
    }
    default:
      return 0;
  }
}
