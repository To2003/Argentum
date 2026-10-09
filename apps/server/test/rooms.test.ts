import { DEFAULT_RULES, resolveRules } from '@gran-negocio/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStore, type Store } from '../src/persistence.js';
import { RoomManager, type Change, type Room } from '../src/rooms.js';

let counter = 0;
const manager = (store: Store = memoryStore(), rules = DEFAULT_RULES) =>
  new RoomManager({
    store,
    clock: { now: () => Date.now() },
    randomSeed: () => '0123456789abcdef0123456789abcdef',
    // Códigos válidos y distintos: ABC + 3 letras del alfabeto sin ambiguas.
    randomCode: () => {
      const n = counter++;
      const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      return `ABC${letters[n % 24]}${letters[Math.floor(n / 24) % 24]}${letters[Math.floor(n / 576) % 24]}`;
    },
    randomToken: () => `token-${String(counter++).padStart(8, '0')}`,
    defaultRules: rules,
    timeScale: 1,
    reconnectGraceMs: 60_000,
    autopilotDelayMs: 1_000,
    botDelayMs: 500,
  });

/** Sala de 2 lista para arrancar. */
function twoPlayers(rooms: RoomManager): { room: Room; host: string; guest: string } {
  const { room, seat } = rooms.create('Ana');
  const joined = rooms.join(room.code, 'Beto');
  if (!joined.ok) throw new Error(joined.error);
  rooms.setReady(room, joined.value.seat.playerId, true);
  return { room, host: seat.playerId, guest: joined.value.seat.playerId };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('lobby', () => {
  it('crea una sala con código de 6 y el creador es el host', () => {
    const rooms = manager();
    const { room, seat } = rooms.create('Ana');
    expect(room.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(room.hostId).toBe(seat.playerId);
    expect(rooms.publicState(room).seats).toEqual([
      {
        playerId: 'p1',
        name: 'Ana',
        tokenId: null,
        ready: false,
        connected: true,
        isBot: false,
        bot: null,
      },
    ]);
  });

  it('el estado público nunca lleva los tokens secretos', () => {
    const rooms = manager();
    const { room, seat } = rooms.create('Ana');
    expect(JSON.stringify(rooms.publicState(room))).not.toContain(seat.token);
  });

  it('unirse: sala inexistente, llena o en partida', () => {
    const rooms = manager();
    expect(rooms.join('ZZZZZZ', 'X')).toEqual({ ok: false, error: 'ROOM_NOT_FOUND' });
    const { room } = rooms.create('Ana');
    rooms.setRules(room, 'p1', { maxPlayers: 2 });
    expect(rooms.join(room.code, 'Beto').ok).toBe(true);
    expect(rooms.join(room.code, 'Caro')).toEqual({ ok: false, error: 'ROOM_FULL' });
    rooms.setReady(room, 'p2', true);
    rooms.start(room, 'p1');
    expect(rooms.join(room.code, 'Dani')).toEqual({ ok: false, error: 'GAME_IN_PROGRESS' });
  });

  it('fichas únicas', () => {
    const rooms = manager();
    const { room } = twoPlayers(rooms);
    expect(rooms.setToken(room, 'p1', 'mate').ok).toBe(true);
    expect(rooms.setToken(room, 'p2', 'mate')).toEqual({ ok: false, error: 'TOKEN_TAKEN' });
  });

  it('las reglas las cambia solo el host, y se validan', () => {
    const rooms = manager();
    const { room } = twoPlayers(rooms);
    expect(rooms.setRules(room, 'p2', { salary: 300 })).toEqual({ ok: false, error: 'NOT_HOST' });
    expect(rooms.setRules(room, 'p1', { maxPlayers: 1 })).toEqual({
      ok: false,
      error: 'BAD_RULES',
    });
    rooms.join(room.code, 'Caro');
    expect(rooms.setRules(room, 'p1', { maxPlayers: 2 })).toEqual({
      ok: false,
      error: 'BAD_RULES',
    });
    expect(rooms.setRules(room, 'p1', { salary: 300 }).ok).toBe(true);
    expect(room.rules.salary).toBe(300);
  });

  it('el default de useRealBrands viene del server (USE_REAL_BRANDS)', () => {
    const rooms = manager(memoryStore(), resolveRules({ useRealBrands: false }));
    expect(rooms.create('Ana').room.rules.useRealBrands).toBe(false);
  });

  it('arrancar: solo el host, mínimo 2, todos listos; reparte fichas a quien no eligió', () => {
    const rooms = manager();
    const { room: alone } = rooms.create('Solo');
    expect(rooms.start(alone, 'p1')).toEqual({ ok: false, error: 'NOT_ENOUGH_PLAYERS' });
    const { room } = twoPlayers(rooms);
    rooms.setReady(room, 'p2', false);
    expect(rooms.start(room, 'p1')).toEqual({ ok: false, error: 'NOT_READY' });
    rooms.setReady(room, 'p2', true);
    expect(rooms.start(room, 'p2')).toEqual({ ok: false, error: 'NOT_HOST' });
    rooms.setToken(room, 'p2', 'mate');
    expect(rooms.start(room, 'p1').ok).toBe(true);
    expect(room.status).toBe('playing');
    expect(room.seats.map((s) => s.tokenId)).toEqual(['bombo', 'mate']);
    expect(rooms.view(room, 'p1')?.players).toHaveLength(2);
  });

  it('si el host se va del lobby, pasa al siguiente que llegó; si no queda nadie, la sala se borra', () => {
    const rooms = manager();
    const { room } = twoPlayers(rooms);
    rooms.leave(room, 'p1');
    expect(room.hostId).toBe('p2');
    rooms.leave(room, 'p2');
    expect(rooms.get(room.code)).toBeUndefined();
  });
});

describe('intents', () => {
  function started() {
    const rooms = manager();
    const players = twoPlayers(rooms);
    rooms.start(players.room, players.host);
    return { rooms, ...players };
  }

  it('aplica una acción legal y sube la versión', () => {
    const { rooms, room } = started();
    const actor = room.state!.currentPlayerId;
    const result = rooms.intent(room, actor, {
      actionId: 'a1',
      expectedVersion: 0,
      action: { type: 'rollDice' },
    });
    expect(result).toEqual({ ok: true, value: { version: 1, duplicate: false } });
    expect(room.log).toHaveLength(1);
  });

  it('expectedVersion distinta → STALE_STATE sin aplicar nada', () => {
    const { rooms, room } = started();
    const actor = room.state!.currentPlayerId;
    expect(
      rooms.intent(room, actor, {
        actionId: 'a1',
        expectedVersion: 7,
        action: { type: 'rollDice' },
      }),
    ).toEqual({
      ok: false,
      error: 'STALE_STATE',
    });
    expect(room.state!.version).toBe(0);
  });

  it('el mismo actionId dos veces se aplica una sola (idempotencia)', () => {
    const { rooms, room } = started();
    const actor = room.state!.currentPlayerId;
    const intent = { actionId: 'a1', expectedVersion: 0, action: { type: 'rollDice' } as const };
    rooms.intent(room, actor, intent);
    expect(rooms.intent(room, actor, intent)).toEqual({
      ok: true,
      value: { version: 1, duplicate: true },
    });
    expect(room.log).toHaveLength(1);
  });

  it('una acción ilegal devuelve el error del engine', () => {
    const { rooms, room } = started();
    const other = room.state!.turnOrder.find((id) => id !== room.state!.currentPlayerId)!;
    expect(
      rooms.intent(room, other, {
        actionId: 'x',
        expectedVersion: 0,
        action: { type: 'rollDice' },
      }),
    ).toEqual({
      ok: false,
      error: 'NOT_YOUR_TURN',
    });
  });

  it('cada cambio avisa con los eventos', () => {
    const { rooms, room } = started();
    const changes: Change[] = [];
    rooms.onChange((change) => changes.push(change));
    rooms.intent(room, room.state!.currentPlayerId, {
      actionId: 'a1',
      expectedVersion: 0,
      action: { type: 'rollDice' },
    });
    expect(changes).toHaveLength(1);
    expect(changes[0]?.game).toBe(true);
    expect(changes[0]?.events.some((e) => e.type === 'diceRolled')).toBe(true);
  });
});

describe('timers y piloto automático (SPEC §8)', () => {
  it('al vencer el timer del turno, juega el piloto (tira)', () => {
    const rooms = manager();
    const { room, host } = twoPlayers(rooms);
    rooms.setRules(room, host, { turnTimerSeconds: 15 });
    rooms.start(room, host);
    expect(rooms.timersOf(room)).toEqual([
      expect.objectContaining({ kind: 'turn', playerIds: [room.state!.currentPlayerId] }),
    ]);
    vi.advanceTimersByTime(14_999);
    expect(room.state!.version).toBe(0);
    vi.advanceTimersByTime(1);
    expect(room.state!.version).toBeGreaterThan(0);
    rooms.stop();
  });

  it('sin timer de turno (0), nadie juega solo', () => {
    const rooms = manager();
    const { room, host } = twoPlayers(rooms);
    rooms.setRules(room, host, { turnTimerSeconds: 0 });
    rooms.start(room, host);
    vi.advanceTimersByTime(10 * 60_000);
    expect(room.state!.version).toBe(0);
    rooms.stop();
  });

  it('un desconectado: después de la gracia lo toma el piloto; si vuelve, recupera el control', () => {
    const rooms = manager();
    const { room, host } = twoPlayers(rooms);
    rooms.setRules(room, host, { turnTimerSeconds: 0 });
    rooms.start(room, host);
    const actor = room.state!.currentPlayerId;
    rooms.setConnected(room, actor, false);
    vi.advanceTimersByTime(59_000);
    expect(room.state!.version).toBe(0);
    vi.advanceTimersByTime(1_000);
    expect(room.state!.version).toBeGreaterThan(0);
    rooms.setConnected(room, actor, true);
    const version = room.state!.version;
    vi.advanceTimersByTime(10 * 60_000);
    // Conectado y sin timer de turno: el piloto ya no juega por él.
    if (room.state!.currentPlayerId === actor) expect(room.state!.version).toBe(version);
    rooms.stop();
  });

  it('partida corta por tiempo: el server manda timeUp', () => {
    const rooms = manager();
    const { room, host } = twoPlayers(rooms);
    rooms.setRules(room, host, { gameDurationMinutes: 30, turnTimerSeconds: 0 });
    rooms.start(room, host);
    vi.advanceTimersByTime(30 * 60_000);
    expect(room.state!.phase).toMatchObject({ kind: 'gameOver', reason: 'time' });
    expect(room.status).toBe('finished');
    expect(room.log.at(-1)).toEqual({ playerId: 'system', action: { type: 'timeUp' } });
    rooms.stop();
  });

  it('subasta: si nadie supera la puja en auctionBidSeconds, se cierra', () => {
    const rooms = manager();
    const { room, host } = twoPlayers(rooms);
    rooms.setRules(room, host, { turnTimerSeconds: 0 });
    rooms.start(room, host);
    // Forzar una subasta abierta a mano.
    room.state!.phase = {
      kind: 'auction',
      lot: { kind: 'property', tile: 3 },
      participants: ['p1', 'p2'],
      highBid: 0,
      highBidder: null,
      queue: [],
      returnTo: { kind: 'finishResolution' },
    };
    const bidder = 'p1';
    rooms.intent(room, bidder, {
      actionId: 'b',
      expectedVersion: room.state!.version,
      action: { type: 'bid', amount: 10 },
    });
    vi.advanceTimersByTime(10_000);
    expect(room.state!.properties[3]?.ownerId).toBe('p1');
    rooms.stop();
  });
});

describe('persistencia', () => {
  it('una sala en partida se restaura reaplicando seed + acciones', () => {
    const store = memoryStore();
    const first = manager(store);
    const { room, host } = twoPlayers(first);
    first.start(room, host);
    for (let i = 0; i < 3; i += 1) {
      const state = room.state!;
      const actor = state.currentPlayerId;
      const action =
        state.phase.kind === 'awaitingPurchase'
          ? 'declineProperty'
          : state.phase.kind === 'postRoll'
            ? 'endTurn'
            : 'rollDice';
      if (state.phase.kind === 'auction') break;
      first.intent(room, actor, {
        actionId: `a${i}`,
        expectedVersion: state.version,
        action: { type: action },
      });
    }
    first.stop();

    const second = manager(store);
    expect(second.restore()).toEqual({ restored: 1, failed: [] });
    const restored = second.get(room.code)!;
    expect(restored.state).toEqual(room.state);
    expect(restored.seats.every((seat) => !seat.connected)).toBe(true);
    // El token sigue sirviendo para reconectar.
    expect(second.resume(room.code, room.seats[0]!.token).ok).toBe(true);
    expect(second.resume(room.code, 'token-que-no-existe')).toEqual({
      ok: false,
      error: 'BAD_TOKEN',
    });
    second.stop();
  });

  it('las salas inactivas se barren', () => {
    const rooms = manager();
    const { room } = rooms.create('Ana');
    vi.advanceTimersByTime(25 * 60 * 60_000);
    expect(rooms.sweep(24 * 60 * 60_000)).toEqual([room.code]);
    expect(rooms.get(room.code)).toBeUndefined();
  });
});

describe('bots (M8)', () => {
  it('solo el host los suma, en el lobby y con lugar; siempre listos y con ficha', () => {
    const rooms = manager();
    const { room, guest } = twoPlayers(rooms);
    expect(rooms.addBot(room, guest, 'easy')).toEqual({ ok: false, error: 'NOT_HOST' });
    const added = rooms.addBot(room, room.hostId, 'hard');
    expect(added.ok).toBe(true);
    const bot = room.seats.at(-1)!;
    expect(bot).toMatchObject({ isBot: true, bot: 'hard', ready: true, name: 'Chiche' });
    expect(bot.tokenId).not.toBeNull();
    expect(rooms.publicState(room).seats.at(-1)).toMatchObject({ bot: 'hard', isBot: true });
    expect(rooms.removeBot(room, room.hostId, guest)).toEqual({ ok: false, error: 'BAD_PAYLOAD' });
    expect(rooms.removeBot(room, room.hostId, bot.playerId).ok).toBe(true);
    rooms.setRules(room, room.hostId, { maxPlayers: 2 });
    expect(rooms.addBot(room, room.hostId, 'easy')).toEqual({ ok: false, error: 'ROOM_FULL' });
  });

  it('una partida de una persona (desconectada) contra dos bots termina sola', () => {
    const rooms = manager();
    const { room, seat } = rooms.create('Ana');
    rooms.addBot(room, seat.playerId, 'medium');
    rooms.addBot(room, seat.playerId, 'hard');
    rooms.setRules(room, seat.playerId, { maxRounds: 8, turnTimerSeconds: 0 });
    expect(rooms.start(room, seat.playerId).ok).toBe(true);
    // Ana se va: la toma el piloto automático; los bots juegan solos.
    rooms.setConnected(room, seat.playerId, false);
    for (let i = 0; i < 2_000 && room.status !== 'finished'; i += 1) vi.advanceTimersByTime(60_000);
    expect(room.status).toBe('finished');
    expect(room.state?.phase.kind).toBe('gameOver');
    rooms.stop();
  });
});
