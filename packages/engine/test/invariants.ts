import {
  BANK_HOTELS,
  BANK_HOUSES,
  DECKS,
  TILE_COUNT,
  isOwnable,
  tileAt,
} from '@gran-negocio/shared';
import { expect } from 'vitest';
import {
  actorOf,
  applyAction,
  CANDIDATE_ACTIONS,
  createGame,
  createRng,
  legalActions,
  nextInt,
  type Action,
  type GameEvent,
  type GameSetup,
  type GameState,
  type PlayerId,
  type RngState,
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

  // Edificios: nunca más de 32 casas / 12 hoteles entre banco y tablero.
  const housesOnBoard = Object.values(state.properties).reduce(
    (sum, p) => sum + (p.houses === 5 ? 0 : p.houses),
    0,
  );
  const hotelsOnBoard = Object.values(state.properties).filter((p) => p.houses === 5).length;
  expect(state.bank.houses + housesOnBoard).toBeLessThanOrEqual(BANK_HOUSES);
  expect(state.bank.hotels + hotelsOnBoard).toBeLessThanOrEqual(BANK_HOTELS);

  // Cada mazo conserva sus 16 cartas, contando las "Salí gratis" retenidas.
  for (const deck of ['chance', 'community'] as const) {
    const held = players.flatMap((p) => p.jailFreeCards).filter((id) => id.startsWith(`${deck}.`));
    expect([...state.decks[deck], ...held].sort()).toEqual(ALL_CARDS[deck]);
  }

  // El orden de turno contiene a cada jugador exactamente una vez.
  expect([...state.turnOrder].sort()).toEqual(Object.keys(state.players).sort());

  // La fase es coherente con quién actúa.
  if (state.phase.kind === 'gameOver') {
    expect(players.filter((p) => !p.bankrupt).length).toBeLessThanOrEqual(1);
    return;
  }
  expect(state.players[state.currentPlayerId]?.bankrupt).toBe(false);
  const actor = actorOf(state);
  expect(actor).not.toBeNull();
  expect(state.players[actor ?? '']?.bankrupt).toBe(false);
  if (state.phase.kind === 'inDebt') {
    expect(state.phase.debts.length).toBeGreaterThan(0);
    for (const debt of state.phase.debts) {
      expect(state.players[debt.debtorId]?.cash).toBeLessThan(debt.amount);
    }
  }
  if (state.phase.kind === 'awaitingPurchase') {
    expect(state.properties[state.phase.tile]).toBeUndefined();
  }
  if (state.phase.kind === 'waitingRoll')
    expect(state.players[state.currentPlayerId]?.inJail).toBe(false);
  if (state.phase.kind === 'jailDecision')
    expect(state.players[state.currentPlayerId]?.inJail).toBe(true);
  // Siempre hay algo legal para el que tiene que actuar: la partida no se traba.
  expect(legalActions(state, actor ?? '').length).toBeGreaterThan(0);
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

/**
 * Juega eligiendo al azar entre las acciones legales (con un PRNG propio, no
 * el de la partida), chequeando invariantes después de cada paso. Cada tanto
 * prueba una acción ilegal y exige que se rechace sin tocar el estado ni el RNG.
 */
export function randomPlay(
  setup: GameSetup,
  options: { readonly steps: number; readonly policySeed: string; readonly maxTurns?: number },
): PlayResult {
  const created = createGame(setup);
  let state = created.state;
  const events: GameEvent[] = [...created.events];
  const log: LoggedAction[] = [];
  const ledger = new Ledger(state);
  ledger.record(created.events);
  checkInvariants(state, ledger);

  let rng: RngState = createRng(options.policySeed);
  const pick = (bound: number): number => {
    const draw = nextInt(rng, bound);
    rng = draw.state;
    return draw.value;
  };
  const playerIds = Object.keys(state.players);

  for (let step = 0; step < options.steps; step += 1) {
    if (options.maxTurns !== undefined && state.turnNumber > options.maxTurns) break;
    const actor = actorOf(state);
    if (actor === null) break;

    // Una ilegal al azar: rechazada, sin cambios y sin consumir RNG.
    const someone = playerIds[pick(playerIds.length)] ?? actor;
    const candidate = CANDIDATE_ACTIONS[pick(CANDIDATE_ACTIONS.length)] ?? { type: 'endTurn' };
    const isLegal = legalActions(state, someone).some((a) => a.type === candidate.type);
    if (!isLegal) {
      const before = snapshot(state);
      const rejected = applyAction(state, someone, candidate);
      expect(rejected.ok).toBe(false);
      expect(snapshot(state)).toBe(before);
    }

    const legal = legalActions(state, actor);
    const action = legal[pick(legal.length)];
    if (action === undefined) throw new Error('sin acciones legales');
    const result = applyAction(state, actor, action);
    if (!result.ok)
      throw new Error(`una acción legal fue rechazada: ${action.type} → ${result.error}`);
    expect(result.state.version).toBe(state.version + 1);
    state = result.state;
    log.push({ playerId: actor, action });
    events.push(...result.events);
    ledger.record(result.events);
    checkInvariants(state, ledger);
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
