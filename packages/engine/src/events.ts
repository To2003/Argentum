import type { DeckKind } from '@gran-negocio/shared';
import type { Dice } from './rng.js';
import type { CardId, MoneyReason, Party, PlayerId, TileIndex } from './types.js';

/**
 * Lo que pasó, en orden. El cliente anima a partir de esto y el server lo
 * persiste; el estado no guarda historial (SPEC.md §15.4).
 *
 * Toda variación de efectivo o del pozo es un `moneyTransferred`: el fuzz test
 * reconstruye la contabilidad entera a partir de los eventos.
 */
export type GameEvent =
  | {
      readonly type: 'diceRolled';
      readonly playerId: PlayerId;
      readonly dice: Dice;
      /** `utilityCard`: la tirada extra de la carta "servicio más cercano"; no cuenta como dobles. */
      readonly reason: 'turnOrder' | 'move' | 'jail' | 'utilityCard';
    }
  | { readonly type: 'turnOrderDecided'; readonly order: readonly PlayerId[] }
  | { readonly type: 'turnStarted'; readonly playerId: PlayerId; readonly turnNumber: number }
  | {
      readonly type: 'moved';
      readonly playerId: PlayerId;
      readonly from: TileIndex;
      readonly to: TileIndex;
      /** Con signo: negativo = hacia atrás. */
      readonly steps: number;
      readonly passedGo: boolean;
      readonly cause: 'dice' | 'card';
    }
  | { readonly type: 'landed'; readonly playerId: PlayerId; readonly tile: TileIndex }
  | {
      readonly type: 'moneyTransferred';
      readonly from: Party;
      readonly to: Party;
      readonly amount: number;
      readonly reason: MoneyReason;
      readonly tile?: TileIndex;
    }
  | { readonly type: 'purchaseOffered'; readonly playerId: PlayerId; readonly tile: TileIndex }
  | { readonly type: 'propertyBought'; readonly playerId: PlayerId; readonly tile: TileIndex }
  | { readonly type: 'purchaseDeclined'; readonly playerId: PlayerId; readonly tile: TileIndex }
  | {
      readonly type: 'cardDrawn';
      readonly playerId: PlayerId;
      readonly deck: DeckKind;
      readonly cardId: CardId;
    }
  | { readonly type: 'jailFreeCardKept'; readonly playerId: PlayerId; readonly cardId: CardId }
  | {
      readonly type: 'sentToJail';
      readonly playerId: PlayerId;
      readonly cause: 'tile' | 'card' | 'threeDoubles';
    }
  | {
      readonly type: 'leftJail';
      readonly playerId: PlayerId;
      readonly method: 'fine' | 'card' | 'doubles' | 'forcedFine';
      /** Solo con `card`. */
      readonly cardId?: CardId;
    }
  | { readonly type: 'jailRollFailed'; readonly playerId: PlayerId; readonly attempt: number }
  | {
      readonly type: 'debtOpened';
      readonly debtorId: PlayerId;
      readonly creditor: Party;
      readonly amount: number;
      readonly reason: MoneyReason;
    }
  | {
      readonly type: 'propertyTransferred';
      readonly tile: TileIndex;
      readonly from: PlayerId;
      /** `bank`: la propiedad queda sin dueño (TODO(M3): subasta). */
      // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- valor especial
      readonly to: PlayerId | 'bank';
    }
  | {
      readonly type: 'jailFreeCardTransferred';
      readonly cardId: CardId;
      readonly from: PlayerId;
      /** `deck`: vuelve al fondo de su mazo. */
      // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- valor especial
      readonly to: PlayerId | 'deck';
    }
  | { readonly type: 'playerBankrupt'; readonly playerId: PlayerId; readonly creditor: Party }
  | { readonly type: 'turnEnded'; readonly playerId: PlayerId }
  | { readonly type: 'gameOver'; readonly winnerId: PlayerId | null };

export type GameEventType = GameEvent['type'];
