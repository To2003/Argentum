import type { ColorGroup, DeckKind, RulesConfig } from '@gran-negocio/shared';
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
  | { readonly kind: 'moveAfterJailFine'; readonly dice: Dice }
  /** Volver exactamente a una fase guardada (subasta de un edificio, deudas pendientes). */
  | { readonly kind: 'restorePhase'; readonly phase: Phase };

/** Lo que se ofrece de un lado de un trueque (SPEC.md §5.6): solo lo que existe hoy. */
export interface TradeBundle {
  readonly cash: number;
  readonly properties: readonly TileIndex[];
  readonly jailFreeCards: readonly CardId[];
}

/**
 * Un trueque abierto. Es estado superpuesto (`state.trade`), no una fase: no
 * cambia quién tiene el turno y responde el receptor, fuera de turno.
 */
export interface TradeState {
  readonly id: number;
  readonly from: PlayerId;
  readonly to: PlayerId;
  /** Lo que da `from`. */
  readonly offer: TradeBundle;
  /** Lo que pide a `to`. */
  readonly request: TradeBundle;
}

/** Qué se subasta. */
export type AuctionLot =
  /** Una propiedad del banco (rechazo de compra o quiebra ante el banco). */
  | { readonly kind: 'property'; readonly tile: TileIndex }
  /** Una casa u hotel escaso (SPEC.md §5.4): `tile` es donde la quiere el que la pidió. */
  | {
      readonly kind: 'building';
      readonly building: 'house' | 'hotel';
      readonly initiator: PlayerId;
      readonly tile: TileIndex;
    };

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
  /**
   * Subasta (SPEC.md §5.2, §5.4, §5.7). Pujan todos los `participants` a la
   * vez; el que pasa queda afuera. Sin reloj en el engine: cuando vence el
   * tiempo, el server pasa por los que no van ganando.
   */
  | {
      readonly kind: 'auction';
      readonly lot: AuctionLot;
      readonly participants: readonly PlayerId[];
      readonly highBid: number;
      readonly highBidder: PlayerId | null;
      /** Propiedades que esperan su subasta (quiebra ante el banco, una por una). */
      readonly queue: readonly TileIndex[];
      readonly returnTo: ResumePoint;
    }
  /** Fin de partida. `winnerId` null solo si no queda nadie. */
  | {
      readonly kind: 'gameOver';
      readonly winnerId: PlayerId | null;
      readonly reason: GameOverReason;
    };

/** Por qué terminó: último en pie, límite de rondas o de tiempo (SPEC.md §5.8). */
export type GameOverReason = 'lastStanding' | 'rounds' | 'time';

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
  /** Todos los jugadores en orden de turno; los quebrados se saltean. */
  turnOrder: PlayerId[];
  currentPlayerId: PlayerId;
  phase: Phase;
  turn: TurnState;
  /** Empieza en 1 y sube con cada cambio de turno. */
  turnNumber: number;
  /** Empieza en 1 y sube cada vez que el turno vuelve al primero del orden (SPEC.md §5.8). */
  round: number;
  /** Solo las casillas con dueño. Sin entrada = del banco. */
  properties: Record<TileIndex, OwnedProperty>;
  bank: { houses: number; hotels: number };
  /** Pozo del Fin de semana largo (solo con `rules.freeParkingPot`). */
  pot: number;
  /** Mazos boca abajo; el índice 0 es el de arriba. Su orden nunca sale del server. */
  decks: Record<DeckKind, CardId[]>;
  /** El trueque abierto, si hay uno (estado superpuesto, SPEC.md §15.4). */
  trade: TradeState | null;
  /** Para numerar los trueques. */
  nextTradeId: number;
}

export type MoneyReason =
  | 'salary'
  | 'purchase'
  | 'rent'
  | 'tax'
  | 'card'
  | 'jailFine'
  | 'pot'
  | 'bankruptcy'
  | 'auction'
  | 'building'
  | 'mortgage'
  | 'mortgageInterest'
  | 'trade';

export type Action =
  | { readonly type: 'rollDice' }
  | { readonly type: 'payJailFine' }
  | { readonly type: 'useJailCard' }
  | { readonly type: 'buyProperty' }
  | { readonly type: 'declineProperty' }
  | { readonly type: 'endTurn' }
  | { readonly type: 'declareBankruptcy' }
  /** Saldar la primera deuda de la cola cuando ya juntó el efectivo. */
  | { readonly type: 'payDebt' }
  | { readonly type: 'bid'; readonly amount: number }
  | { readonly type: 'passAuction' }
  | { readonly type: 'buildHouse'; readonly tile: TileIndex }
  /** Vende un edificio (un hotel vuelve a 4 casas). */
  | { readonly type: 'sellBuilding'; readonly tile: TileIndex }
  /** Vende todos los edificios de un grupo: siempre posible, aunque falten casas en el banco. */
  | { readonly type: 'sellAllBuildings'; readonly group: ColorGroup }
  | { readonly type: 'mortgage'; readonly tile: TileIndex }
  | { readonly type: 'unmortgage'; readonly tile: TileIndex }
  | {
      readonly type: 'proposeTrade';
      readonly to: PlayerId;
      readonly offer: TradeBundle;
      readonly request: TradeBundle;
    }
  /** El receptor responde con otra propuesta: se invierten los roles. */
  | { readonly type: 'counterTrade'; readonly offer: TradeBundle; readonly request: TradeBundle }
  | { readonly type: 'acceptTrade' }
  | { readonly type: 'rejectTrade' }
  | { readonly type: 'cancelTrade' }
  /** Solo el actor `system` (el server): venció el tiempo de la partida corta. */
  | { readonly type: 'timeUp' };

export type ActionType = Action['type'];

export type ErrorCode =
  | 'GAME_OVER'
  | 'UNKNOWN_PLAYER'
  | 'NOT_YOUR_TURN'
  | 'WRONG_PHASE'
  | 'INSUFFICIENT_FUNDS'
  | 'NO_JAIL_CARD'
  | 'NOT_OWNER'
  | 'INVALID_TILE'
  | 'INCOMPLETE_GROUP'
  | 'GROUP_MORTGAGED'
  | 'UNEVEN_BUILDING'
  | 'NO_BUILDINGS_LEFT'
  | 'MAX_BUILDINGS'
  | 'HAS_BUILDINGS'
  | 'ALREADY_MORTGAGED'
  | 'NOT_MORTGAGED'
  | 'BID_TOO_LOW'
  | 'HIGH_BIDDER_CANNOT_PASS'
  | 'TRADE_OPEN'
  | 'NO_TRADE'
  | 'INVALID_TRADE'
  | 'DEBT_NOT_COVERED';

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
