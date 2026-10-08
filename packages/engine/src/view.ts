import type { DeckKind } from '@gran-negocio/shared';
import { legalActions } from './legal.js';
import type { Dice } from './rng.js';
import type {
  Action,
  CardId,
  OwnedProperty,
  Phase,
  PlayerId,
  ReadonlyGameState,
  TileIndex,
  TradeState,
} from './types.js';
import type { RulesConfig } from '@gran-negocio/shared';

/**
 * Lo que puede saber un jugador (SPEC.md §3.1).
 *
 * Todo lo oculto está oculto por **construcción**: la vista se arma campo por
 * campo desde el estado, nunca borrando de una copia, así un campo nuevo del
 * estado no se filtra por olvido. Se ocultan `rngState` y el orden de los
 * mazos: con cualquiera de los dos se predicen tiradas y cartas.
 */
export interface PublicPlayer {
  readonly id: PlayerId;
  readonly name: string;
  readonly tokenId: string;
  readonly cash: number;
  readonly position: TileIndex;
  readonly inJail: boolean;
  readonly jailAttempts: number;
  readonly jailFreeCards: readonly CardId[];
  readonly bankrupt: boolean;
}

export interface PlayerView {
  readonly version: number;
  /** Para quién es la vista; null = espectador. */
  readonly viewerId: PlayerId | null;
  readonly rules: RulesConfig;
  /** En orden de turno. */
  readonly players: readonly PublicPlayer[];
  readonly currentPlayerId: PlayerId;
  readonly phase: Phase;
  readonly turn: {
    readonly doublesCount: number;
    readonly rollAgain: boolean;
    readonly lastRoll: Dice | null;
  };
  readonly turnNumber: number;
  readonly round: number;
  /** El trueque abierto: es público (SPEC.md §3.1, no hay información oculta en el juego). */
  readonly trade: TradeState | null;
  readonly properties: Readonly<Record<TileIndex, OwnedProperty>>;
  readonly bank: { readonly houses: number; readonly hotels: number };
  readonly pot: number;
  /** Solo cuántas cartas quedan boca abajo, nunca cuáles ni en qué orden. */
  readonly decks: Readonly<Record<DeckKind, { readonly remaining: number }>>;
  /** Lo que el viewer puede hacer ahora. */
  readonly legal: readonly Action[];
}

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function toPlayerView(state: ReadonlyGameState, viewerId: PlayerId | null): PlayerView {
  return {
    version: state.version,
    viewerId,
    rules: { ...state.rules },
    players: state.turnOrder.flatMap((id) => {
      const player = state.players[id];
      if (player === undefined) return [];
      return [
        {
          id: player.id,
          name: player.name,
          tokenId: player.tokenId,
          cash: player.cash,
          position: player.position,
          inJail: player.inJail,
          jailAttempts: player.jailAttempts,
          jailFreeCards: [...player.jailFreeCards],
          bankrupt: player.bankrupt,
        },
      ];
    }),
    currentPlayerId: state.currentPlayerId,
    phase: copy<Phase>(state.phase),
    turn: {
      doublesCount: state.turn.doublesCount,
      rollAgain: state.turn.rollAgain,
      lastRoll:
        state.turn.lastRoll === null ? null : [state.turn.lastRoll[0], state.turn.lastRoll[1]],
    },
    turnNumber: state.turnNumber,
    round: state.round,
    trade: state.trade === null ? null : copy<TradeState>(state.trade),
    properties: copy<Record<TileIndex, OwnedProperty>>(state.properties),
    bank: { houses: state.bank.houses, hotels: state.bank.hotels },
    pot: state.pot,
    decks: {
      chance: { remaining: state.decks.chance.length },
      community: { remaining: state.decks.community.length },
    },
    legal: viewerId === null ? [] : legalActions(state, viewerId),
  };
}
