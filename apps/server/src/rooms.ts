import {
  actorOf,
  actorsOf,
  applyAction,
  autopilotAction,
  createGame,
  SYSTEM_ACTOR,
  toPlayerView,
  type Action,
  type GameEvent,
  type GameState,
  type PlayerId,
  type PlayerView,
} from '@gran-negocio/engine';
import {
  MIN_PLAYERS,
  resolveRules,
  TOKEN_IDS,
  type RulesConfig,
  type RulesOverrides,
} from '@gran-negocio/shared';
import type { LoggedAction, Store, StoredRoom } from './persistence.js';
import type { PublicSeat, RoomState, RoomStatus, ServerError, TimerState } from './protocol.js';

/**
 * Salas en memoria, con persistencia en un `Store` (SPEC.md §8).
 *
 * No sabe nada de sockets: `handlers.ts` traduce mensajes a llamadas y
 * difunde lo que `onChange` avisa. Así esto se testea sin red.
 *
 * Los códigos, seeds y tokens salen de `deps` (en producción, `node:crypto`);
 * nunca del PRNG del engine, que es determinista a propósito.
 */

export interface Seat {
  readonly playerId: PlayerId;
  name: string;
  tokenId: string | null;
  ready: boolean;
  /** Secreto: solo lo recibe su dueño, una vez. */
  readonly token: string;
  readonly isBot: boolean;
  readonly joined: number;
  connected: boolean;
  /** Desde cuándo está desconectado (para el período de gracia). */
  disconnectedAt: number | null;
}

/** Recuerda las últimas acciones de cada jugador para ignorar duplicados. */
const IDEMPOTENCY_WINDOW = 64;

export interface Room {
  readonly code: string;
  hostId: PlayerId;
  status: RoomStatus;
  seed: string | null;
  rules: RulesConfig;
  readonly createdAt: number;
  lastActivity: number;
  startedAt: number | null;
  seats: Seat[];
  nextJoined: number;
  state: GameState | null;
  log: LoggedAction[];
  /** actionId → versión resultante, por jugador (idempotencia). */
  seen: Map<PlayerId, Map<string, number>>;
  /** Para los timers: desde cuándo se espera esta decisión. */
  waiting: { key: string; since: number };
  /** Última puja (o apertura) de la subasta en curso. */
  auctionSince: number;
  /** Desde cuándo está abierto el trueque actual. */
  trade: { id: number; since: number } | null;
  /** false en los escenarios de desarrollo: su estado no sale de seed + acciones. */
  persisted: boolean;
}

export interface Clock {
  now(): number;
}

export interface RoomDeps {
  readonly store: Store;
  readonly clock: Clock;
  readonly randomSeed: () => string;
  readonly randomCode: () => string;
  readonly randomToken: () => string;
  /** Reglas por defecto de cada sala nueva (con USE_REAL_BRANDS ya aplicado). */
  readonly defaultRules: RulesConfig;
  /** Multiplica los segundos de las reglas (los tests lo achican). */
  readonly timeScale: number;
  /** Período de gracia antes de que el piloto automático tome a un desconectado. */
  readonly reconnectGraceMs: number;
  /** Pausa entre acciones del piloto automático, para que se puedan seguir. */
  readonly autopilotDelayMs: number;
}

export type Result<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ServerError };

const fail = (error: ServerError): { ok: false; error: ServerError } => ({ ok: false, error });
const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });

/** Lo que pasó en una sala, para que el transporte lo difunda. */
export interface Change {
  readonly room: Room;
  readonly events: readonly GameEvent[];
  /** true si cambió la partida (no solo el lobby). */
  readonly game: boolean;
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private listener: (change: Change) => void = () => undefined;

  private readonly deps: RoomDeps;

  constructor(deps: RoomDeps) {
    this.deps = deps;
  }

  onChange(listener: (change: Change) => void): void {
    this.listener = listener;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  get size(): number {
    return this.rooms.size;
  }

  // ---------------------------------------------------------------- lobby

  create(name: string): { room: Room; seat: Seat } {
    let code = this.deps.randomCode();
    while (this.rooms.has(code)) code = this.deps.randomCode();
    const now = this.deps.clock.now();
    const room: Room = {
      code,
      hostId: '',
      status: 'lobby',
      seed: null,
      rules: { ...this.deps.defaultRules },
      createdAt: now,
      lastActivity: now,
      startedAt: null,
      seats: [],
      nextJoined: 1,
      state: null,
      log: [],
      seen: new Map(),
      waiting: { key: '', since: now },
      auctionSince: now,
      trade: null,
      persisted: true,
    };
    const seat = this.addSeat(room, name, false);
    room.hostId = seat.playerId;
    this.rooms.set(code, room);
    this.persist(room);
    return { room, seat };
  }

  join(code: string, name: string): Result<{ room: Room; seat: Seat }> {
    const room = this.rooms.get(code);
    if (room === undefined) return fail('ROOM_NOT_FOUND');
    if (room.status !== 'lobby') return fail('GAME_IN_PROGRESS');
    if (room.seats.length >= room.rules.maxPlayers) return fail('ROOM_FULL');
    const seat = this.addSeat(room, name, false);
    this.touch(room);
    this.emit(room, [], false);
    return ok({ room, seat });
  }

  /** Reconexión con el token del asiento (SPEC.md §8). */
  resume(code: string, token: string): Result<{ room: Room; seat: Seat }> {
    const room = this.rooms.get(code);
    if (room === undefined) return fail('ROOM_NOT_FOUND');
    const seat = room.seats.find((candidate) => candidate.token === token);
    if (seat === undefined || seat.isBot) return fail('BAD_TOKEN');
    return ok({ room, seat });
  }

  setConnected(room: Room, playerId: PlayerId, connected: boolean): void {
    const seat = this.seatOf(room, playerId);
    if (seat === undefined || seat.connected === connected) return;
    seat.connected = connected;
    seat.disconnectedAt = connected ? null : this.deps.clock.now();
    this.emit(room, [], false);
    this.schedule(room);
  }

  leave(room: Room, playerId: PlayerId): void {
    if (room.status !== 'lobby') {
      // En partida no se puede sacar a nadie: queda desconectado y lo toma el
      // piloto automático (SPEC.md §15.6).
      this.setConnected(room, playerId, false);
      return;
    }
    room.seats = room.seats.filter((seat) => seat.playerId !== playerId);
    if (room.seats.every((seat) => seat.isBot)) {
      this.destroy(room);
      return;
    }
    if (room.hostId === playerId) {
      const next = room.seats.filter((seat) => !seat.isBot).sort((a, b) => a.joined - b.joined)[0];
      if (next !== undefined) room.hostId = next.playerId;
    }
    this.touch(room);
    this.emit(room, [], false);
  }

  setToken(room: Room, playerId: PlayerId, tokenId: string): Result<null> {
    if (room.status !== 'lobby') return fail('GAME_IN_PROGRESS');
    const taken = room.seats.some((seat) => seat.playerId !== playerId && seat.tokenId === tokenId);
    if (taken) return fail('TOKEN_TAKEN');
    const seat = this.seatOf(room, playerId);
    if (seat === undefined) return fail('NO_SESSION');
    seat.tokenId = tokenId;
    this.touch(room);
    this.emit(room, [], false);
    return ok(null);
  }

  setReady(room: Room, playerId: PlayerId, ready: boolean): Result<null> {
    if (room.status !== 'lobby') return fail('GAME_IN_PROGRESS');
    const seat = this.seatOf(room, playerId);
    if (seat === undefined) return fail('NO_SESSION');
    seat.ready = ready;
    this.touch(room);
    this.emit(room, [], false);
    return ok(null);
  }

  setRules(room: Room, playerId: PlayerId, overrides: RulesOverrides): Result<null> {
    if (room.status !== 'lobby') return fail('GAME_IN_PROGRESS');
    if (room.hostId !== playerId) return fail('NOT_HOST');
    let rules: RulesConfig;
    try {
      rules = resolveRules(overrides, room.rules);
    } catch {
      return fail('BAD_RULES');
    }
    if (rules.maxPlayers < room.seats.length) return fail('BAD_RULES');
    room.rules = rules;
    this.touch(room);
    this.emit(room, [], false);
    return ok(null);
  }

  /** El host arranca: mínimo 2, todos listos (el host cuenta como listo). */
  start(room: Room, playerId: PlayerId): Result<null> {
    if (room.status !== 'lobby') return fail('GAME_IN_PROGRESS');
    if (room.hostId !== playerId) return fail('NOT_HOST');
    if (room.seats.length < MIN_PLAYERS) return fail('NOT_ENOUGH_PLAYERS');
    if (room.seats.some((seat) => seat.playerId !== room.hostId && !seat.ready)) {
      return fail('NOT_READY');
    }
    // Quien no eligió ficha recibe la primera libre.
    for (const seat of room.seats) {
      if (seat.tokenId !== null) continue;
      const used = new Set(room.seats.map((other) => other.tokenId));
      seat.tokenId = TOKEN_IDS.find((id) => !used.has(id)) ?? null;
    }
    const seed = this.deps.randomSeed();
    const created = createGame({
      seed,
      rules: room.rules,
      players: [...room.seats]
        .sort((a, b) => a.joined - b.joined)
        .map((seat) => ({ id: seat.playerId, name: seat.name, tokenId: seat.tokenId ?? '' })),
    });
    room.seed = seed;
    room.state = created.state;
    room.status = 'playing';
    room.startedAt = this.deps.clock.now();
    room.log = [];
    room.seen = new Map();
    this.deps.store.clearActions(room.code);
    this.touch(room);
    this.resetWaiting(room, created.events);
    this.emit(room, created.events, true);
    this.schedule(room);
    return ok(null);
  }

  /**
   * Una sala de desarrollo ya en partida (SCENARIOS): Ana y Beto, sin timer de
   * turno, que no se persiste. Devuelve los tokens para entrar como cada uno.
   */
  createScenario(apply: (state: GameState) => void): { room: Room; seats: Seat[] } {
    const { room, seat: ana } = this.create('Ana');
    room.persisted = false;
    this.deps.store.deleteRoom(room.code);
    const beto = this.addSeat(room, 'Beto', false);
    ana.tokenId = 'mate';
    beto.tokenId = 'bombo';
    beto.ready = true;
    room.rules = { ...room.rules, turnTimerSeconds: 0 };
    this.start(room, ana.playerId);
    const state = room.state;
    if (state === null) throw new Error('el escenario no arrancó');
    state.turnOrder = [ana.playerId, beto.playerId];
    state.currentPlayerId = ana.playerId;
    state.turn = { doublesCount: 0, rollAgain: false, lastRoll: null };
    apply(state);
    ana.connected = false;
    beto.connected = false;
    this.resetWaiting(room, []);
    this.emit(room, [], true);
    return { room, seats: [ana, beto] };
  }

  // ---------------------------------------------------------------- partida

  /**
   * Un intent del cliente. Idempotente por `actionId`; si `expectedVersion` no
   * coincide con la versión actual no aplica nada y responde STALE_STATE.
   */
  intent(
    room: Room,
    playerId: PlayerId,
    intent: { actionId: string; expectedVersion: number; action: Action },
  ): Result<{ version: number; duplicate: boolean }> {
    if (room.state === null) return fail('GAME_NOT_STARTED');
    const seen = room.seen.get(playerId)?.get(intent.actionId);
    if (seen !== undefined) return ok({ version: seen, duplicate: true });
    if (intent.expectedVersion !== room.state.version) return fail('STALE_STATE');
    const applied = this.apply(room, playerId, intent.action);
    if (!applied.ok) return applied;
    this.remember(room, playerId, intent.actionId, applied.value);
    return ok({ version: applied.value, duplicate: false });
  }

  /** La vista de la partida para un asiento (o un espectador, con null). */
  view(room: Room, playerId: PlayerId | null): PlayerView | null {
    return room.state === null ? null : toPlayerView(room.state, playerId);
  }

  timersOf(room: Room): TimerState[] {
    return this.pending(room).map(({ kind, deadline, playerIds }) => ({
      kind,
      deadline,
      playerIds,
    }));
  }

  publicState(room: Room): RoomState {
    return {
      code: room.code,
      hostId: room.hostId,
      status: room.status,
      rules: room.rules,
      seats: [...room.seats]
        .sort((a, b) => a.joined - b.joined)
        .map((seat): PublicSeat => ({
          playerId: seat.playerId,
          name: seat.name,
          tokenId: seat.tokenId,
          ready: seat.ready,
          connected: seat.connected,
          isBot: seat.isBot,
        })),
    };
  }

  // ---------------------------------------------------------------- restauración y limpieza

  /** Trae las salas guardadas reaplicando sus acciones (SPEC.md §3.1). */
  restore(): { restored: number; failed: string[] } {
    const failed: string[] = [];
    let restored = 0;
    for (const { room: stored, actions } of this.deps.store.loadRooms()) {
      try {
        const room = this.fromStored(stored);
        if (stored.seed !== null && stored.status !== 'lobby') {
          let state = createGame({
            seed: stored.seed,
            rules: stored.rules,
            players: [...stored.seats]
              .sort((a, b) => a.joined - b.joined)
              .map((seat) => ({ id: seat.playerId, name: seat.name, tokenId: seat.tokenId ?? '' })),
          }).state;
          for (const entry of actions) {
            const result = applyAction(state, entry.playerId, entry.action);
            if (!result.ok) throw new Error(`replay rechazado: ${result.error}`);
            state = result.state;
          }
          room.state = state;
          room.log = [...actions];
        }
        this.rooms.set(room.code, room);
        this.resetWaiting(room, []);
        this.schedule(room);
        restored += 1;
      } catch {
        failed.push(stored.code);
      }
    }
    return { restored, failed };
  }

  /** Borra las salas sin actividad hace más de `ttlMs`. */
  sweep(ttlMs: number): string[] {
    const now = this.deps.clock.now();
    const dropped: string[] = [];
    for (const room of this.rooms.values()) {
      if (now - room.lastActivity > ttlMs) {
        this.destroy(room);
        dropped.push(room.code);
      }
    }
    return dropped;
  }

  /** Para cerrar el server (y los tests): apaga todos los timers. */
  stop(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  // ---------------------------------------------------------------- internos

  private addSeat(room: Room, name: string, isBot: boolean): Seat {
    const seat: Seat = {
      playerId: `p${room.nextJoined}`,
      name,
      tokenId: null,
      ready: false,
      token: this.deps.randomToken(),
      isBot,
      joined: room.nextJoined,
      connected: !isBot,
      disconnectedAt: null,
    };
    room.nextJoined += 1;
    room.seats.push(seat);
    return seat;
  }

  private seatOf(room: Room, playerId: PlayerId): Seat | undefined {
    return room.seats.find((seat) => seat.playerId === playerId);
  }

  /** Aplica en el engine, guarda en el log, persiste y avisa. Devuelve la versión nueva. */
  private apply(room: Room, playerId: PlayerId, action: Action): Result<number> {
    if (room.state === null) return fail('GAME_NOT_STARTED');
    const result = applyAction(room.state, playerId, action);
    if (!result.ok) return fail(result.error);
    room.state = result.state;
    const entry = { playerId, action };
    if (room.persisted) this.deps.store.appendAction(room.code, room.log.length, entry);
    room.log.push(entry);
    if (room.state.phase.kind === 'gameOver') room.status = 'finished';
    this.touch(room);
    this.resetWaiting(room, result.events);
    this.emit(room, result.events, true);
    this.schedule(room);
    return ok(room.state.version);
  }

  private remember(room: Room, playerId: PlayerId, actionId: string, version: number): void {
    const seen = room.seen.get(playerId) ?? new Map<string, number>();
    seen.set(actionId, version);
    if (seen.size > IDEMPOTENCY_WINDOW) {
      const oldest = seen.keys().next().value;
      if (oldest !== undefined) seen.delete(oldest);
    }
    room.seen.set(playerId, seen);
  }

  /** Reinicia los relojes de lo que cambió: decisión, subasta, trueque. */
  private resetWaiting(room: Room, events: readonly GameEvent[]): void {
    const now = this.deps.clock.now();
    const state = room.state;
    if (state === null) return;
    const key = `${state.phase.kind}:${actorOf(state) ?? ''}:${state.turnNumber}`;
    if (key !== room.waiting.key) room.waiting = { key, since: now };
    if (events.some((event) => event.type === 'auctionOpened' || event.type === 'bidPlaced')) {
      room.auctionSince = now;
    }
    if (state.trade === null) room.trade = null;
    else if (room.trade?.id !== state.trade.id) room.trade = { id: state.trade.id, since: now };
  }

  /** Qué está esperando la sala, con su deadline y qué hacer si vence. */
  private pending(room: Room): {
    kind: TimerState['kind'];
    deadline: number;
    playerIds: PlayerId[];
    act: () => void;
  }[] {
    const state = room.state;
    if (state === null || state.phase.kind === 'gameOver') return [];
    const scale = (seconds: number) => seconds * 1000 * this.deps.timeScale;
    const list: ReturnType<RoomManager['pending']> = [];

    const { gameDurationMinutes, turnTimerSeconds, auctionBidSeconds } = state.rules;
    if (gameDurationMinutes !== null && room.startedAt !== null) {
      list.push({
        kind: 'game',
        deadline: room.startedAt + scale(gameDurationMinutes * 60),
        playerIds: [],
        act: () => this.apply(room, SYSTEM_ACTOR, { type: 'timeUp' }),
      });
    }

    // Desconectados (o bots, M8) que tienen que actuar: el piloto automático,
    // después del período de gracia y con una pausa para que se pueda seguir.
    for (const id of actorsOf(state)) {
      const seat = this.seatOf(room, id);
      if (seat === undefined || seat.connected) continue;
      const action = autopilotAction(state, id, 'disconnected');
      if (action === null) continue;
      const graceEnd = (seat.disconnectedAt ?? 0) + this.deps.reconnectGraceMs;
      const deadline = Math.max(graceEnd, room.lastActivity + this.deps.autopilotDelayMs);
      list.push({
        kind: 'turn',
        deadline,
        playerIds: [id],
        act: () => this.apply(room, id, action),
      });
    }

    if (state.phase.kind === 'auction') {
      const { participants, highBidder } = state.phase;
      const waiting = participants.filter((id) => id !== highBidder);
      if (waiting.length > 0)
        list.push({
          kind: 'auction',
          deadline: room.auctionSince + scale(auctionBidSeconds),
          playerIds: waiting,
          act: () => {
            // Se pasa por todos los que no van ganando, de a uno: cierra la subasta.
            const next = waiting[0];
            if (next !== undefined) this.apply(room, next, { type: 'passAuction' });
          },
        });
    } else if (turnTimerSeconds > 0) {
      if (state.trade !== null && room.trade !== null) {
        const { to } = state.trade;
        list.push({
          kind: 'trade',
          deadline: room.trade.since + scale(turnTimerSeconds),
          playerIds: [to],
          act: () => this.apply(room, to, { type: 'rejectTrade' }),
        });
      }
      const actor = actorOf(state);
      const action = actor === null ? null : autopilotAction(state, actor, 'timeout');
      if (actor !== null && action !== null) {
        list.push({
          kind: 'turn',
          deadline: room.waiting.since + scale(turnTimerSeconds),
          playerIds: [actor],
          act: () => this.apply(room, actor, action),
        });
      }
    }
    return list;
  }

  /** Un solo timer por sala, al deadline más cercano. */
  private schedule(room: Room, minDelay = 0): void {
    const existing = this.timers.get(room.code);
    if (existing !== undefined) clearTimeout(existing);
    this.timers.delete(room.code);
    const pending = this.pending(room);
    if (pending.length === 0) return;
    const next = Math.min(...pending.map((item) => item.deadline));
    const delay = Math.max(minDelay, next - this.deps.clock.now());
    const timer = setTimeout(() => {
      this.timers.delete(room.code);
      this.tick(room);
    }, delay);
    this.timers.set(room.code, timer);
  }

  private tick(room: Room): void {
    const now = this.deps.clock.now();
    const due = this.pending(room)
      .filter((item) => item.deadline <= now)
      .sort((a, b) => a.deadline - b.deadline)[0];
    if (due === undefined) {
      this.schedule(room);
      return;
    }
    const before = room.state?.version;
    due.act();
    // Si no se aplicó (no debería), reintentar más tarde: nunca un bucle en caliente.
    if (room.state?.version === before) this.schedule(room, 1000);
  }

  private touch(room: Room): void {
    room.lastActivity = this.deps.clock.now();
    this.persist(room);
  }

  private persist(room: Room): void {
    if (!room.persisted) return;
    const stored: StoredRoom = {
      code: room.code,
      hostId: room.hostId,
      status: room.status,
      seed: room.seed,
      rules: room.rules,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity,
      startedAt: room.startedAt,
      seats: room.seats.map((seat) => ({
        playerId: seat.playerId,
        name: seat.name,
        tokenId: seat.tokenId,
        ready: seat.ready,
        token: seat.token,
        isBot: seat.isBot,
        joined: seat.joined,
      })),
    };
    this.deps.store.saveRoom(stored);
  }

  private fromStored(stored: StoredRoom): Room {
    const now = this.deps.clock.now();
    return {
      code: stored.code,
      hostId: stored.hostId,
      status: stored.status,
      seed: stored.seed,
      rules: stored.rules,
      createdAt: stored.createdAt,
      lastActivity: stored.lastActivity,
      startedAt: stored.startedAt,
      // Nadie está conectado recién reiniciado: vuelven con su token.
      seats: stored.seats.map((seat) => ({
        ...seat,
        connected: false,
        disconnectedAt: seat.isBot ? null : now,
      })),
      nextJoined: stored.seats.reduce((top, seat) => Math.max(top, seat.joined), 0) + 1,
      state: null,
      log: [],
      seen: new Map(),
      waiting: { key: '', since: now },
      auctionSince: now,
      trade: null,
      persisted: true,
    };
  }

  private destroy(room: Room): void {
    const timer = this.timers.get(room.code);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.delete(room.code);
    this.rooms.delete(room.code);
    this.deps.store.deleteRoom(room.code);
  }

  private emit(room: Room, events: readonly GameEvent[], game: boolean): void {
    this.listener({ room, events, game });
  }
}
