import type { DeckKind, RulesConfig } from '@gran-negocio/shared';
import type { Dice, RngState } from './rng.js';

export type PlayerId = string;
export type TileIndex = number;
export type CardId = string;

/**
 * A quién se le paga o de dónde sale la plata. `bank` y `pot` no pueden ser
 * ids de jugador: createGame los rechaza (RESERVED_PLAYER_IDS).
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- documenta los valores especiales
export type Party = PlayerId | 'bank' | 'pot';

export interface PlayerState {
  readonly id: PlayerId;
  readonly name: string;
  readonly tokenId: string;
  cash: number;
  position: TileIndex;
  inJail: boolean;
  /** Intentos fallidos de sacar dobles en la cárcel, en esta estadía. */
  jailAttempts: number;
  /** Ids de las cartas "Salí de la cárcel gratis" que tiene (son públicas). */
  jailFreeCards: CardId[];
  bankrupt: boolean;
}

export interface OwnedProperty {
  ownerId: PlayerId;
  /** 0–4 casas; 5 = hotel. */
  houses: 0 | 1 | 2 | 3 | 4 | 5;
  mortgaged: boolean;
}

/** Algo que alguien debe y no pudo pagar en efectivo. */
export interface Debt {
  readonly debtorId: PlayerId;
  readonly creditor: Party;
  readonly amount: number;
  readonly reason: MoneyReason;
}

/**
 * Qué hacer cuando se saldan las deudas (SPEC.md §3.4: las fases
 * interrumpibles llevan `returnTo`).
 */
export type ResumePoint =
  /** Terminar la resolución de la casilla: volver a tirar si hubo dobles, o postRoll. */
  | { readonly kind: 'finishResolution' }
  /** Tercer intento en la cárcel: con la fianza paga, mover con esa tirada. */
  | { readonly kind: 'moveAfterJailFine'; readonly dice: Dice };

/**
 * Las fases que se guardan en el estado (ADR 0004). Tirar, mover, resolver la
 * casilla, cobrar y robar carta pasan dentro de un mismo `applyAction`: no son
 * fases, son eventos.
 */
export type Phase =
  /** El jugador del turno tiene que tirar (también después de sacar dobles). */
  | { readonly kind: 'waitingRoll' }
  /** El jugador del turno empieza preso: paga, usa la carta o tira por dobles. */
  | { readonly kind: 'jailDecision' }
  /** Cayó en una propiedad sin dueño: compra o rechaza. */
  | { readonly kind: 'awaitingPurchase'; readonly tile: TileIndex }
  /** Ya tiró y no le quedan tiradas: puede terminar el turno (en M3, construir, hipotecar, comerciar). */
  | { readonly kind: 'postRoll' }
  /** Alguien debe plata. Actúa el primer deudor de la cola, no el jugador del turno. */
  | { readonly kind: 'inDebt'; readonly debts: readonly Debt[]; readonly returnTo: ResumePoint }
  /** null solo si no queda nadie (no debería pasar: la quiebra deja al menos uno). */
  | { readonly kind: 'gameOver'; readonly winnerId: PlayerId | null };

export type PhaseKind = Phase['kind'];

export interface TurnState {
  /** Dobles seguidos en este turno. */
  doublesCount: number;
  /** El jugador sacó dobles y le toca volver a tirar. */
  rollAgain: boolean;
  lastRoll: Dice | null;
}

export interface GameState {
  /** Sube con cada acción aplicada (el server la compara con `expectedVersion`). */
  version: number;
  readonly rules: RulesConfig;
  /** Estado del PRNG. Nunca sale del server. */
  rngState: RngState;
  players: Record<PlayerId, PlayerState>;
  /** Jugadores activos (no quebrados) en orden de turno. */
  turnOrder: PlayerId[];
  currentPlayerId: PlayerId;
  phase: Phase;
  turn: TurnState;
  /** Empieza en 1 y sube con cada cambio de turno. */
  turnNumber: number;
  /** Solo las casillas con dueño. Sin entrada = del banco. */
  properties: Record<TileIndex, OwnedProperty>;
  bank: { houses: number; hotels: number };
  /** Pozo del Fin de semana largo (solo con `rules.freeParkingPot`). */
  pot: number;
  /** Mazos boca abajo; el índice 0 es el de arriba. Su orden nunca sale del server. */
  decks: Record<DeckKind, CardId[]>;
}

export type MoneyReason =
  'salary' | 'purchase' | 'rent' | 'tax' | 'card' | 'jailFine' | 'pot' | 'bankruptcy';

export type Action =
  | { readonly type: 'rollDice' }
  | { readonly type: 'payJailFine' }
  | { readonly type: 'useJailCard' }
  | { readonly type: 'buyProperty' }
  | { readonly type: 'declineProperty' }
  | { readonly type: 'endTurn' }
  | { readonly type: 'declareBankruptcy' };

export type ActionType = Action['type'];

export type ErrorCode =
  | 'GAME_OVER'
  | 'UNKNOWN_PLAYER'
  | 'NOT_YOUR_TURN'
  | 'WRONG_PHASE'
  | 'INSUFFICIENT_FUNDS'
  | 'NO_JAIL_CARD';

export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

export type ReadonlyGameState = DeepReadonly<GameState>;

export interface PlayerSetup {
  readonly id: PlayerId;
  readonly name: string;
  readonly tokenId: string;
}
