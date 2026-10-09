import {
  BOARD,
  GROUP_TILES,
  isOwnable,
  tileAt,
  type ColorGroup,
  type OwnableTile,
} from '@gran-negocio/shared';
import { legalActions } from '../legal.js';
import { tradeContentError } from '../rules/trade.js';
import type { Action, PlayerId, ReadonlyGameState, TileIndex, TradeBundle } from '../types.js';
import { actorOf } from '../validate.js';

/**
 * Bots (SPEC.md §8, M8). Usan el mismo canal que los humanos: devuelven una
 * acción que después pasa por `validateAction`. Son deterministas (sin azar):
 * mismo estado, misma jugada. La memoria solo evita que propongan el mismo
 * trueque una y otra vez en el mismo turno.
 *
 * - Fácil: compra todo lo que puede, nunca construye, nunca comercia.
 * - Medio: prioriza completar grupos y mantiene una reserva de efectivo.
 * - Difícil: valúa por retorno de cada grupo, construye fuerte en naranjas y
 *   rojos (los de mejor retorno del clásico) y propone y evalúa trueques.
 */
export type BotDifficulty = 'easy' | 'medium' | 'hard';

export const BOT_DIFFICULTIES: readonly BotDifficulty[] = ['easy', 'medium', 'hard'];

export interface BotMemory {
  /** El último turno en que propuso un trueque. */
  lastProposalTurn: number;
}

export const newBotMemory = (): BotMemory => ({ lastProposalTurn: -1 });

interface Profile {
  /** Efectivo que no gasta en compras ni subastas. */
  readonly reserve: number;
  /** Efectivo que le tiene que quedar después de construir. */
  readonly buildReserve: number;
  /** Cuánto paga en una subasta respecto de lo que valúa la propiedad. */
  readonly auctionFactor: number;
  readonly trades: boolean;
  /** Le importa completar grupos (y bloquear los ajenos) al comprar. */
  readonly strategic: boolean;
}

const PROFILES: Readonly<Record<BotDifficulty, Profile>> = {
  // Compra todo lo que puede, puja bajo y nunca construye: no aprovecha los grupos.
  easy: { reserve: 0, buildReserve: Infinity, auctionFactor: 0.5, trades: false, strategic: false },
  // Compra casi todo con una reserva chica, puja lo que vale y construye con el grupo completo.
  medium: { reserve: 50, buildReserve: 150, auctionFactor: 1.0, trades: false, strategic: true },
  // Igual, valuando por retorno, construyendo más fuerte y negociando trueques.
  hard: { reserve: 50, buildReserve: 100, auctionFactor: 1.1, trades: true, strategic: true },
};

/**
 * Peso de cada grupo para el bot difícil: los naranjas y rojos son los de
 * mejor retorno en el clásico (los más pisados, a la salida de la cárcel).
 */
const GROUP_ROI: Readonly<Record<ColorGroup, number>> = {
  brown: 0.85,
  lightBlue: 1.1,
  pink: 1.1,
  orange: 1.3,
  red: 1.2,
  yellow: 1.0,
  green: 0.9,
  darkBlue: 0.95,
};

/** El orden en que el difícil construye: mejor retorno primero. */
const BUILD_ORDER: readonly ColorGroup[] = [
  'orange',
  'red',
  'lightBlue',
  'pink',
  'yellow',
  'darkBlue',
  'green',
  'brown',
];

const cashOf = (state: ReadonlyGameState, playerId: PlayerId) => state.players[playerId]?.cash ?? 0;

const ownerOf = (state: ReadonlyGameState, tile: TileIndex) => state.properties[tile]?.ownerId;

const find = (legal: readonly Action[], type: Action['type']) => legal.find((a) => a.type === type);

/** Las demás propiedades del grupo (o de la misma clase, para subtes y servicios). */
function siblings(tile: OwnableTile): readonly TileIndex[] {
  if (tile.kind === 'property') return GROUP_TILES[tile.group].filter((i) => i !== tile.index);
  return BOARD.filter((other) => other.kind === tile.kind && other.index !== tile.index).map(
    (other) => other.index,
  );
}

/**
 * Cuánto vale una propiedad para `playerId`. Completar un grupo la multiplica;
 * en el difícil, también bloquear el de otro y el retorno del grupo.
 */
export function valuation(
  state: ReadonlyGameState,
  playerId: PlayerId,
  index: TileIndex,
  difficulty: BotDifficulty,
): number {
  const tile = tileAt(index);
  if (!isOwnable(tile)) return 0;
  const profile = PROFILES[difficulty];
  let value = tile.price;
  if (!profile.strategic) return value;
  const others = siblings(tile);
  const mine = others.filter((i) => ownerOf(state, i) === playerId).length;
  if (tile.kind === 'property' && mine === others.length)
    value *= difficulty === 'hard' ? 2.2 : 1.6;
  else if (mine > 0) value *= 1.25;
  if (difficulty === 'hard') {
    if (tile.kind === 'property') value *= GROUP_ROI[tile.group];
    const rivals = new Set(others.map((i) => ownerOf(state, i)).filter((o) => o !== undefined));
    const [rival] = [...rivals];
    // Un solo rival tiene todo el resto del grupo: comprarla lo bloquea.
    if (tile.kind === 'property' && rivals.size === 1 && rival !== playerId) {
      if (others.every((i) => ownerOf(state, i) === rival)) value *= 1.5;
    }
  }
  return Math.round(value);
}

/** Si quedarse con `index` le completa a `playerId` un grupo de color. */
const completesGroup = (state: ReadonlyGameState, playerId: PlayerId, index: TileIndex) => {
  const tile = tileAt(index);
  return (
    tile.kind === 'property' &&
    GROUP_TILES[tile.group].every((i) => i === index || ownerOf(state, i) === playerId)
  );
};

/** Cuánto vale un lado de un trueque para `playerId` (las hipotecadas valen la mitad). */
function bundleValue(
  state: ReadonlyGameState,
  playerId: PlayerId,
  bundle: TradeBundle,
  difficulty: BotDifficulty,
): number {
  let value = bundle.cash + bundle.jailFreeCards.length * 50;
  for (const index of bundle.properties) {
    const half = state.properties[index]?.mortgaged === true ? 0.5 : 1;
    value += valuation(state, playerId, index, difficulty) * half;
  }
  return value;
}

/** Si después del trueque `playerId` completaría algún grupo que hoy no tiene. */
function tradeCompletesGroupFor(
  state: ReadonlyGameState,
  playerId: PlayerId,
  received: readonly TileIndex[],
): boolean {
  return received.some((index) => {
    const tile = tileAt(index);
    if (tile.kind !== 'property') return false;
    return GROUP_TILES[tile.group].every(
      (i) => received.includes(i) || ownerOf(state, i) === playerId,
    );
  });
}

function respondToTrade(
  state: ReadonlyGameState,
  playerId: PlayerId,
  difficulty: BotDifficulty,
  legal: readonly Action[],
): Action | null {
  const { trade } = state;
  if (trade === null) return null;
  const reject = find(legal, 'rejectTrade') ?? null;
  const accept = find(legal, 'acceptTrade');
  if (difficulty === 'easy' || accept === undefined) return reject;
  const gets = bundleValue(state, playerId, trade.offer, difficulty);
  const gives = bundleValue(state, playerId, trade.request, difficulty);
  // Darle a otro un grupo completo cuesta caro: solo si gana uno también.
  const theyComplete = tradeCompletesGroupFor(state, trade.from, trade.request.properties);
  const iComplete = tradeCompletesGroupFor(state, playerId, trade.offer.properties);
  if (theyComplete && !iComplete) return reject;
  const margin = difficulty === 'hard' ? 1.05 : 1.25;
  return gets >= gives * margin ? accept : reject;
}

function auctionMove(
  state: ReadonlyGameState,
  playerId: PlayerId,
  difficulty: BotDifficulty,
  legal: readonly Action[],
): Action | null {
  const { phase } = state;
  if (phase.kind !== 'auction' || phase.highBidder === playerId) return null;
  const pass = find(legal, 'passAuction') ?? null;
  const bid = legal.find((action) => action.type === 'bid');
  if (bid?.type !== 'bid') return pass;
  const profile = PROFILES[difficulty];
  const worth =
    phase.lot.kind === 'property'
      ? valuation(state, playerId, phase.lot.tile, difficulty) * profile.auctionFactor
      : // La última casa: vale su precio más lo que niega a los rivales.
        (tileAt(phase.lot.tile).kind === 'property' ? 1 : 0) * 100 * profile.auctionFactor * 1.5;
  const affordable = cashOf(state, playerId) - bid.amount >= profile.reserve;
  return bid.amount <= worth && affordable ? bid : pass;
}

/** La deuda: pagar si alcanza; si no, vender, hipotecar lo que menos sirve y, al final, quebrar. */
function debtMove(
  state: ReadonlyGameState,
  playerId: PlayerId,
  legal: readonly Action[],
): Action | null {
  const pay = find(legal, 'payDebt');
  if (pay !== undefined) return pay;
  const sell = find(legal, 'sellBuilding') ?? find(legal, 'sellAllBuildings');
  if (sell !== undefined) return sell;
  const mortgages = legal.filter(
    (action): action is Extract<Action, { type: 'mortgage' }> => action.type === 'mortgage',
  );
  if (mortgages.length > 0) {
    // Primero lo que no es parte de un grupo completo, y lo más barato.
    const sorted = [...mortgages].sort((a, b) => {
      const ta = tileAt(a.tile);
      const tb = tileAt(b.tile);
      const ma = completesGroup(state, playerId, a.tile) ? 1 : 0;
      const mb = completesGroup(state, playerId, b.tile) ? 1 : 0;
      return ma - mb || (isOwnable(ta) ? ta.price : 0) - (isOwnable(tb) ? tb.price : 0);
    });
    return sorted[0] ?? null;
  }
  return find(legal, 'declareBankruptcy') ?? null;
}

function purchaseMove(
  state: ReadonlyGameState,
  playerId: PlayerId,
  difficulty: BotDifficulty,
  legal: readonly Action[],
): Action | null {
  const { phase } = state;
  if (phase.kind !== 'awaitingPurchase') return null;
  const tile = tileAt(phase.tile);
  if (!isOwnable(tile)) return find(legal, 'declineProperty') ?? null;
  const profile = PROFILES[difficulty];
  const cash = cashOf(state, playerId);
  const key =
    completesGroup(state, playerId, phase.tile) ||
    valuation(state, playerId, phase.tile, difficulty) >= tile.price * 1.4;
  const wants = difficulty === 'easy' ? true : cash - tile.price >= profile.reserve || key;
  const buy = find(legal, 'buyProperty');
  if (wants && buy !== undefined) return buy;
  // Para una clave que no alcanza: hipotecar algo suelto y volver a intentar.
  if (wants && key && difficulty !== 'easy') {
    const spare = legal.find(
      (action) => action.type === 'mortgage' && !completesGroup(state, playerId, action.tile),
    );
    if (spare !== undefined) return spare;
  }
  return find(legal, 'declineProperty') ?? null;
}

function jailMove(
  state: ReadonlyGameState,
  playerId: PlayerId,
  difficulty: BotDifficulty,
  legal: readonly Action[],
): Action | null {
  const roll = find(legal, 'rollDice') ?? null;
  const card = find(legal, 'useJailCard');
  const pay = find(legal, 'payJailFine');
  // Mientras quedan propiedades libres conviene salir a comprar; tarde, la
  // cárcel protege de los alquileres altos.
  const free = BOARD.filter(
    (tile) => isOwnable(tile) && ownerOf(state, tile.index) === undefined,
  ).length;
  const early = free > 8;
  if (difficulty === 'easy') return cashOf(state, playerId) > 300 && pay !== undefined ? pay : roll;
  if (early) return card ?? pay ?? roll;
  return roll;
}

/** Construir, levantar hipotecas y (el difícil) proponer trueques, antes de tirar o terminar. */
function manage(
  state: ReadonlyGameState,
  playerId: PlayerId,
  difficulty: BotDifficulty,
  memory: BotMemory,
  legal: readonly Action[],
): Action | null {
  const profile = PROFILES[difficulty];
  const cash = cashOf(state, playerId);

  // Levantar hipotecas con plata de sobra (primero las de grupos propios).
  if (difficulty !== 'easy' && cash > 700) {
    const lift = legal.find((action) => action.type === 'unmortgage');
    if (lift !== undefined) return lift;
  }

  const builds = legal.filter(
    (action): action is Extract<Action, { type: 'buildHouse' }> => action.type === 'buildHouse',
  );
  if (builds.length > 0) {
    const ranked = [...builds].sort((a, b) => {
      const ta = tileAt(a.tile);
      const tb = tileAt(b.tile);
      if (ta.kind !== 'property' || tb.kind !== 'property') return 0;
      return difficulty === 'hard'
        ? BUILD_ORDER.indexOf(ta.group) - BUILD_ORDER.indexOf(tb.group)
        : ta.houseCost - tb.houseCost;
    });
    for (const build of ranked) {
      const tile = tileAt(build.tile);
      if (tile.kind === 'property' && cash - tile.houseCost >= profile.buildReserve) return build;
    }
  }

  if (profile.trades && state.trade === null && memory.lastProposalTurn !== state.turnNumber) {
    const proposal = tradeProposal(state, playerId, difficulty);
    if (proposal !== null) {
      memory.lastProposalTurn = state.turnNumber;
      return proposal;
    }
  }
  return null;
}

/**
 * El difícil busca un grupo donde le falta una sola propiedad que tiene otro
 * y le ofrece plata por ella (1,6 veces el precio, sin tocar su reserva).
 */
function tradeProposal(
  state: ReadonlyGameState,
  playerId: PlayerId,
  difficulty: BotDifficulty,
): Action | null {
  const cash = cashOf(state, playerId);
  for (const group of BUILD_ORDER) {
    const tiles = GROUP_TILES[group];
    const missing = tiles.filter((i) => ownerOf(state, i) !== playerId);
    if (missing.length !== 1) continue;
    const [target] = missing;
    if (target === undefined) continue;
    const owner = ownerOf(state, target);
    if (owner === undefined || owner === playerId) continue;
    const tile = tileAt(target);
    if (!isOwnable(tile)) continue;
    const offerCash = Math.min(cash - PROFILES[difficulty].reserve, Math.round(tile.price * 1.6));
    if (offerCash < tile.price) continue;
    const offer: TradeBundle = { cash: offerCash, properties: [], jailFreeCards: [] };
    const request: TradeBundle = { cash: 0, properties: [target], jailFreeCards: [] };
    if (tradeContentError(state, playerId, owner, offer, request) === null) {
      return { type: 'proposeTrade', to: owner, offer, request };
    }
  }
  return null;
}

/**
 * La jugada del bot ahora, o null si no le toca hacer nada (o está esperando,
 * como el que va ganando una subasta).
 */
export function botAction(
  state: ReadonlyGameState,
  playerId: PlayerId,
  difficulty: BotDifficulty,
  memory: BotMemory,
): Action | null {
  const legal = legalActions(state, playerId);
  const { phase } = state;
  if (phase.kind === 'gameOver') return null;

  if (state.trade?.to === playerId && phase.kind !== 'auction') {
    const response = respondToTrade(state, playerId, difficulty, legal);
    if (response !== null) return response;
  }
  if (phase.kind === 'auction') return auctionMove(state, playerId, difficulty, legal);
  if (actorOf(state) !== playerId) return null;

  switch (phase.kind) {
    case 'inDebt':
      return debtMove(state, playerId, legal);
    case 'awaitingPurchase':
      return purchaseMove(state, playerId, difficulty, legal);
    case 'jailDecision':
      return (
        manage(state, playerId, difficulty, memory, legal) ??
        jailMove(state, playerId, difficulty, legal)
      );
    case 'waitingRoll':
      return manage(state, playerId, difficulty, memory, legal) ?? find(legal, 'rollDice') ?? null;
    case 'postRoll':
      return manage(state, playerId, difficulty, memory, legal) ?? find(legal, 'endTurn') ?? null;
  }
}
