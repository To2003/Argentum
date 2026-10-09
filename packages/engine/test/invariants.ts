import {
  BANK_HOTELS,
  BANK_HOUSES,
  COLOR_GROUPS,
  DECKS,
  GROUP_TILES,
  TILE_COUNT,
  isOwnable,
  tileAt,
} from '@gran-negocio/shared';
import { expect } from 'vitest';
import {
  actorsOf,
  applyAction,
  CANDIDATE_ACTIONS,
  createGame,
  emptyStats,
  recordStats,
  createRng,
  legalActions,
  nextInt,
  type Action,
  type GameEvent,
  type GameSetup,
  type GameState,
  type PlayerId,
  type RngState,
  type TradeBundle,
} from '../src/index.js';

/**
 * Contabilidad a partir de los eventos: cuánto salió del banco y cuánto entró.
 * Entre jugadores y el pozo la plata solo cambia de mano.
 */
export class Ledger {
  private initial = 0;
  private fromBank = 0;
  private toBank = 0;

  constructor(state: GameState) {
    this.initial = Object.values(state.players).reduce((sum, p) => sum + p.cash, 0) + state.pot;
  }

  record(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type !== 'moneyTransferred') continue;
      if (event.from === 'bank') this.fromBank += event.amount;
      if (event.to === 'bank') this.toBank += event.amount;
    }
  }

  expected(): number {
    return this.initial + this.fromBank - this.toBank;
  }
}

const ALL_CARDS = {
  chance: DECKS.chance.map((c) => c.id).sort(),
  community: DECKS.community.map((c) => c.id).sort(),
};

/** Todo lo que tiene que valer después de cualquier secuencia de acciones legales. */
export function checkInvariants(state: GameState, ledger: Ledger): void {
  const players = Object.values(state.players);

  // Dinero conservado contando el banco, y siempre entero y no negativo.
  const total = players.reduce((sum, p) => sum + p.cash, 0) + state.pot;
  expect(total).toBe(ledger.expected());
  for (const player of players) {
    expect(Number.isInteger(player.cash)).toBe(true);
    expect(player.cash).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(player.position)).toBe(true);
    expect(player.position).toBeGreaterThanOrEqual(0);
    expect(player.position).toBeLessThan(TILE_COUNT);
    if (player.bankrupt) {
      expect(player.cash).toBe(0);
      expect(player.jailFreeCards).toEqual([]);
    }
  }
  expect(Number.isInteger(state.pot)).toBe(true);
  expect(state.pot).toBeGreaterThanOrEqual(0);

  // Una propiedad = un dueño, que existe y está activo.
  for (const [key, owned] of Object.entries(state.properties)) {
    expect(isOwnable(tileAt(Number(key)))).toBe(true);
    const owner = state.players[owned.ownerId];
    expect(owner).toBeDefined();
    expect(owner?.bankrupt).toBe(false);
  }

  // Edificios: exactamente 32 casas y 12 hoteles entre banco y tablero, nunca negativos.
  const housesOnBoard = Object.values(state.properties).reduce(
    (sum, p) => sum + (p.houses === 5 ? 0 : p.houses),
    0,
  );
  const hotelsOnBoard = Object.values(state.properties).filter((p) => p.houses === 5).length;
  expect(state.bank.houses).toBeGreaterThanOrEqual(0);
  expect(state.bank.hotels).toBeGreaterThanOrEqual(0);
  expect(state.bank.houses + housesOnBoard).toBe(BANK_HOUSES);
  expect(state.bank.hotels + hotelsOnBoard).toBe(BANK_HOTELS);

  // Edificios solo en grupos completos y sin hipotecas; construcción pareja.
  for (const group of COLOR_GROUPS) {
    const tiles = GROUP_TILES[group];
    const houses = tiles.map((tile) => state.properties[tile]?.houses ?? 0);
    if (houses.every((h) => h === 0)) continue;
    const owner = state.properties[tiles[0] ?? -1]?.ownerId;
    for (const tile of tiles) {
      expect(state.properties[tile]?.ownerId).toBe(owner);
      expect(state.properties[tile]?.mortgaged).toBe(false);
    }
    if (state.rules.evenBuild) {
      expect(Math.max(...houses) - Math.min(...houses)).toBeLessThanOrEqual(1);
    }
  }
  // Hipotecas coherentes: una hipotecada nunca tiene edificios; edificios solo en propiedades.
  for (const [key, owned] of Object.entries(state.properties)) {
    if (owned.mortgaged) expect(owned.houses).toBe(0);
    if (owned.houses > 0) expect(tileAt(Number(key)).kind).toBe('property');
  }

  // Cada mazo conserva sus 16 cartas, contando las "Salí gratis" retenidas.
  for (const deck of ['chance', 'community'] as const) {
    const held = players.flatMap((p) => p.jailFreeCards).filter((id) => id.startsWith(`${deck}.`));
    expect([...state.decks[deck], ...held].sort()).toEqual(ALL_CARDS[deck]);
  }

  // El orden de turno contiene a cada jugador exactamente una vez.
  expect([...state.turnOrder].sort()).toEqual(Object.keys(state.players).sort());

  // Trueque abierto: entre dos jugadores activos distintos.
  if (state.trade !== null) {
    expect(state.trade.from).not.toBe(state.trade.to);
    expect(state.players[state.trade.from]?.bankrupt).toBe(false);
    expect(state.players[state.trade.to]?.bankrupt).toBe(false);
  }

  // La fase es coherente con quién actúa.
  if (state.phase.kind === 'gameOver') {
    if (state.phase.reason === 'lastStanding') {
      expect(players.filter((p) => !p.bankrupt).length).toBeLessThanOrEqual(1);
    }
    expect(state.trade).toBeNull();
    return;
  }
  expect(state.players[state.currentPlayerId]?.bankrupt).toBe(false);
  const actors = actorsOf(state);
  expect(actors.length).toBeGreaterThan(0);
  for (const actor of actors) expect(state.players[actor]?.bankrupt).toBe(false);
  if (state.phase.kind === 'inDebt') {
    expect(state.phase.debts.length).toBeGreaterThan(0);
    for (const debt of state.phase.debts) expect(debt.amount).toBeGreaterThan(0);
  }
  if (state.phase.kind === 'auction') {
    const { phase } = state;
    for (const id of phase.participants) expect(state.players[id]?.bankrupt).toBe(false);
    if (phase.highBidder !== null) {
      expect(phase.participants).toContain(phase.highBidder);
      expect(state.players[phase.highBidder]?.cash).toBeGreaterThanOrEqual(phase.highBid);
    }
    if (phase.lot.kind === 'property') expect(state.properties[phase.lot.tile]).toBeUndefined();
  }
  if (state.phase.kind === 'awaitingPurchase') {
    expect(state.properties[state.phase.tile]).toBeUndefined();
  }
  if (state.phase.kind === 'waitingRoll')
    expect(state.players[state.currentPlayerId]?.inJail).toBe(false);
  if (state.phase.kind === 'jailDecision')
    expect(state.players[state.currentPlayerId]?.inJail).toBe(true);
  // Siempre hay algo legal para alguien: la partida no se traba.
  expect(actors.some((actor) => legalActions(state, actor).length > 0)).toBe(true);
}

export interface LoggedAction {
  readonly playerId: PlayerId;
  readonly action: Action;
}

export interface PlayResult {
  readonly state: GameState;
  readonly log: readonly LoggedAction[];
  readonly events: readonly GameEvent[];
}

const snapshot = (state: GameState) => JSON.stringify(state);

type Pick = (bound: number) => number;

/** Un lado de trueque al azar con lo que `owner` tiene hoy (puede quedar inválido a propósito). */
function randomBundle(state: GameState, owner: PlayerId, pick: Pick): TradeBundle {
  const owned = Object.entries(state.properties)
    .filter(([, p]) => p.ownerId === owner)
    .map(([tile]) => Number(tile));
  const properties = owned.filter(() => pick(3) === 0);
  const cash = pick(4) === 0 ? pick((state.players[owner]?.cash ?? 0) + 1) : 0;
  const cards = (state.players[owner]?.jailFreeCards ?? []).filter(() => pick(2) === 0);
  return { cash, properties, jailFreeCards: cards };
}

/** Acciones con parámetros libres que `legalActions` no enumera: pujas y trueques. */
function extraCandidates(state: GameState, actor: PlayerId, pick: Pick): Action[] {
  const extra: Action[] = [];
  const others = Object.keys(state.players).filter((id) => id !== actor);
  const other = others[pick(others.length)];
  if (other !== undefined) {
    extra.push({
      type: 'proposeTrade',
      to: other,
      offer: randomBundle(state, actor, pick),
      request: randomBundle(state, other, pick),
    });
  }
  if (state.trade !== null) {
    extra.push({
      type: 'counterTrade',
      offer: randomBundle(state, state.trade.to, pick),
      request: randomBundle(state, state.trade.from, pick),
    });
  }
  if (state.phase.kind === 'auction') {
    const cash = state.players[actor]?.cash ?? 0;
    extra.push({ type: 'bid', amount: state.phase.highBid + 1 + pick(Math.max(1, cash)) });
  }
  return extra;
}

/**
 * Juega eligiendo al azar entre las acciones legales (con un PRNG propio, no
 * el de la partida), chequeando invariantes después de cada paso. Cada tanto
 * prueba una acción ilegal y exige que se rechace sin tocar el estado ni el
 * RNG. También prueba pujas y trueques al azar (válidos o no).
 */
export function randomPlay(
  setup: GameSetup,
  options: {
    readonly steps: number;
    readonly policySeed: string;
    readonly maxTurns?: number;
    /** Arma un escenario sobre la partida recién creada (p. ej. una partida avanzada). */
    readonly prepare?: (state: GameState) => void;
    /**
     * Tipos de acción a favorecer: si el actor tiene alguno legal, la mitad de
     * las veces elige entre esos. Sin esto, en una partida avanzada la
     * política se iba a hipotecar y trocar (hay muchas más opciones de eso) y a
     * veces nunca construía. Sin `prefer`, el azar es exactamente el de antes.
     */
    readonly prefer?: readonly Action['type'][];
  },
): PlayResult {
  const created = createGame(setup);
  let state = created.state;
  options.prepare?.(state);
  const events: GameEvent[] = [...created.events];
  const log: LoggedAction[] = [];
  const ledger = new Ledger(state);
  ledger.record(created.events);
  checkInvariants(state, ledger);
  // Las estadísticas (M9) tienen que cerrar con el efectivo de cada uno.
  const startCash = Object.fromEntries(Object.values(state.players).map((p) => [p.id, p.cash]));
  let stats = emptyStats(state);

  let rng: RngState = createRng(options.policySeed);
  const pick: Pick = (bound) => {
    const draw = nextInt(rng, Math.max(1, bound));
    rng = draw.state;
    return draw.value;
  };
  const playerIds = Object.keys(state.players);

  const apply = (playerId: PlayerId, action: Action) => {
    const result = applyAction(state, playerId, action);
    if (!result.ok)
      throw new Error(`una acción legal fue rechazada: ${action.type} → ${result.error}`);
    expect(result.state.version).toBe(state.version + 1);
    state = result.state;
    log.push({ playerId, action });
    events.push(...result.events);
    ledger.record(result.events);
    checkInvariants(state, ledger);
    stats = recordStats(stats, state, result.events);
    for (const player of Object.values(state.players)) {
      const own = stats.players[player.id];
      expect((startCash[player.id] ?? 0) + (own?.collected ?? 0) - (own?.paid ?? 0)).toBe(
        player.cash,
      );
    }
  };

  /** Prueba una acción: aceptada o no, `applyAction` no toca el estado de entrada (ni su RNG). */
  const probe = (playerId: PlayerId, action: Action): boolean => {
    const before = snapshot(state);
    const result = applyAction(state, playerId, action);
    expect(snapshot(state)).toBe(before);
    return result.ok;
  };

  for (let step = 0; step < options.steps; step += 1) {
    if (options.maxTurns !== undefined && state.turnNumber > options.maxTurns) break;
    if (state.phase.kind === 'gameOver') break;

    // Una acción al azar de un jugador al azar: si se rechaza, no cambia nada.
    const someone = playerIds[pick(playerIds.length)] ?? 'p1';
    const candidate = CANDIDATE_ACTIONS[pick(CANDIDATE_ACTIONS.length)] ?? { type: 'endTurn' };
    probe(someone, candidate);

    // Muy de vez en cuando se acaba el tiempo (solo si la sala tiene partida corta).
    if (state.rules.gameDurationMinutes !== null && pick(400) === 0) {
      apply('system', { type: 'timeUp' });
      break;
    }

    const actors = actorsOf(state).filter((id) => legalActions(state, id).length > 0);
    const actor = actors[pick(actors.length)];
    if (actor === undefined) throw new Error('nadie puede actuar');

    // Una de cada tantas: una acción con parámetros libres, si resulta legal.
    if (pick(6) === 0) {
      const extras = extraCandidates(state, actor, pick);
      const extra = extras[pick(extras.length)];
      if (extra !== undefined && probe(actor, extra)) {
        apply(actor, extra);
        continue;
      }
    }

    const legal = legalActions(state, actor);
    const { prefer } = options;
    const preferred =
      prefer === undefined ? [] : legal.filter((candidate) => prefer.includes(candidate.type));
    const pool = preferred.length > 0 && pick(2) === 0 ? preferred : legal;
    const action = pool[pick(pool.length)];
    if (action === undefined) throw new Error('sin acciones legales');
    apply(actor, action);
  }
  return { state, log, events };
}

/** Reaplica un log desde el seed. */
export function replay(setup: GameSetup, log: readonly LoggedAction[]): PlayResult {
  const created = createGame(setup);
  let state = created.state;
  const events: GameEvent[] = [...created.events];
  for (const { playerId, action } of log) {
    const result = applyAction(state, playerId, action);
    if (!result.ok) throw new Error(`replay rechazado: ${action.type} → ${result.error}`);
    state = result.state;
    events.push(...result.events);
  }
  return { state, log, events };
}
