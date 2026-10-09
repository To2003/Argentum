import type { AddressInfo } from 'node:net';
import type { Action, PlayerView } from '@gran-negocio/engine';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { createGameServer, type GameServer } from '../src/app.js';
import type {
  Ack,
  ChatMessage,
  GameSnapshot,
  GameUpdate,
  RoomState,
  Session,
} from '../src/protocol.js';

let server: GameServer | null = null;
const clients: Socket[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) client.close();
  await server?.close();
  server = null;
});

async function start(
  options: Partial<Parameters<typeof createGameServer>[0]> = {},
): Promise<string> {
  server = createGameServer({
    allowedOrigins: ['http://localhost:5173'],
    reconnectGraceMs: 200,
    autopilotDelayMs: 5,
    // Los bots del test contestan cada actualización al instante: el límite
    // de producción los frenaría (eso lo prueba su propio test).
    rateLimit: { capacity: 1_000_000, perSecond: 1_000_000 },
    ...options,
  });
  await new Promise<void>((resolve) => server?.httpServer.listen(0, resolve));
  const { port } = server.httpServer.address() as AddressInfo;
  return `http://localhost:${port}`;
}

function client(url: string): Socket {
  const socket = connect(url, { transports: ['websocket'], forceNew: true });
  clients.push(socket);
  return socket;
}

const send = <T extends object | null = null>(socket: Socket, event: string, payload?: unknown) =>
  (payload === undefined
    ? socket.timeout(5000).emitWithAck(event)
    : socket.timeout(5000).emitWithAck(event, payload)) as Promise<Ack<T>>;

/**
 * Un jugador del test: mira su vista y, cada vez que cambia, elige al azar
 * entre sus acciones legales (como un bot, por el mismo canal de intents).
 */
class Player {
  view: PlayerView | null = null;
  /** Rechazadas por las reglas: tiene que ser 0 (se eligen de `legal`). */
  rejected = 0;
  stale = 0;
  limited = 0;
  private n = 0;
  socket: Socket;
  readonly session: Session;

  constructor(socket: Socket, session: Session) {
    this.socket = socket;
    this.session = session;
    this.listen(socket);
  }

  listen(socket: Socket): void {
    this.socket = socket;
    socket.on('game:snapshot', (snapshot: GameSnapshot) => {
      this.view = snapshot.view;
      this.act();
    });
    socket.on('game:update', (update: GameUpdate) => {
      this.view = update.view;
      this.act();
    });
  }

  act(): void {
    const view = this.view;
    if (view === null || view.legal.length === 0) return;
    let action = view.legal[Math.floor(Math.random() * view.legal.length)] as Action;
    // En una subasta, casi siempre pasa: pujar de a $1 sin parar es un spam
    // que el rate limit corta (y alarga la partida sin probar nada nuevo).
    if (action.type === 'bid' && Math.random() < 0.7) {
      action = view.legal.find((a) => a.type === 'passAuction') ?? action;
    }
    this.n += 1;
    void send<{ version: number }>(this.socket, 'game:intent', {
      actionId: `${this.session.playerId}-${this.n}`,
      expectedVersion: view.version,
      action,
    })
      .then((ack) => {
        if (ack.ok) return;
        if (ack.error === 'STALE_STATE') this.stale += 1;
        else if (ack.error === 'RATE_LIMITED') this.limited += 1;
        else this.rejected += 1;
      })
      // El socket que se corta a propósito deja intents sin respuesta.
      .catch(() => undefined);
  }
}

const until = async (condition: () => boolean, ms = 30_000) => {
  const deadline = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('timeout esperando la condición');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

describe('server de juego por sockets (M4)', () => {
  it('4 clientes juegan una partida entera; uno se corta y vuelve con su token', async () => {
    const url = await start();
    const hostSocket = client(url);
    const created = await send<{ session: Session }>(hostSocket, 'room:create', { name: 'Ana' });
    if (!created.ok) throw new Error(created.error);
    const { code } = created.session;
    expect(code).toMatch(/^[A-Z2-9]{6}$/);

    const sessions: { socket: Socket; session: Session }[] = [
      { socket: hostSocket, session: created.session },
    ];
    for (const name of ['Beto', 'Caro', 'Dani']) {
      const socket = client(url);
      const joined = await send<{ session: Session }>(socket, 'room:join', {
        code: code.toLowerCase(),
        name,
      });
      if (!joined.ok) throw new Error(joined.error);
      await send(socket, 'lobby:setReady', { ready: true });
      sessions.push({ socket, session: joined.session });
    }

    const lobby = await new Promise<RoomState>((resolve) => {
      hostSocket.once('room:state', resolve);
      void send(hostSocket, 'lobby:setRules', {
        rules: { maxRounds: 12, turnTimerSeconds: 0 },
      });
    });
    expect(lobby.rules.maxRounds).toBe(12);
    expect(JSON.stringify(lobby)).not.toContain(created.session.token);

    const players = sessions.map(({ socket, session }) => new Player(socket, session));
    const startAck = await send(hostSocket, 'lobby:start');
    expect(startAck.ok).toBe(true);

    // A mitad de partida, el tercero se corta y vuelve con su token.
    await until(() => (players[0]?.view?.version ?? 0) > 40);
    const dropped = players[2]!;
    dropped.socket.close();
    await new Promise((resolve) => setTimeout(resolve, 400)); // pasa la gracia: lo toma el piloto
    const back = client(url);
    const snapshot = new Promise<GameSnapshot>((resolve) => back.once('game:snapshot', resolve));
    dropped.listen(back);
    const resumed = await send<{ session: Session }>(back, 'room:resume', {
      code: dropped.session.code,
      token: dropped.session.token,
    });
    expect(resumed.ok).toBe(true);
    const after = await snapshot;
    expect(after.view.viewerId).toBe(dropped.session.playerId);
    expect(after.seq).toBeGreaterThan(40);

    await until(() => players.every((p) => p.view?.phase.kind === 'gameOver'), 45_000);
    const final = players[0]!.view!;
    expect(final.phase).toMatchObject({ kind: 'gameOver' });
    // Todos ven el mismo estado final.
    for (const p of players) expect(p.view?.version).toBe(final.version);
    // Ninguna acción elegida de `legal` fue rechazada por las reglas (solo por
    // versión vieja: varios actúan a la vez en las subastas).
    expect(players.reduce((sum, p) => sum + p.rejected, 0)).toBe(0);
    // La vista nunca trae el estado del PRNG ni el orden de los mazos.
    expect(JSON.stringify(final)).not.toContain('rngState');
  }, 60_000);

  it('valida los mensajes con zod y exige sesión', async () => {
    const url = await start();
    const socket = client(url);
    expect(await send(socket, 'room:create', { name: '' })).toEqual({
      ok: false,
      error: 'BAD_PAYLOAD',
    });
    expect(await send(socket, 'room:create', { name: 'x', extra: 1 })).toEqual({
      ok: false,
      error: 'BAD_PAYLOAD',
    });
    expect(await send(socket, 'room:join', { code: 'nope', name: 'x' })).toEqual({
      ok: false,
      error: 'BAD_PAYLOAD',
    });
    expect(await send(socket, 'room:join', { code: 'ABCDEF', name: 'x' })).toEqual({
      ok: false,
      error: 'ROOM_NOT_FOUND',
    });
    expect(await send(socket, 'lobby:start')).toEqual({ ok: false, error: 'NO_SESSION' });
    expect(
      await send(socket, 'game:intent', {
        actionId: 'a',
        expectedVersion: 0,
        action: { type: 'timeUp' },
      }),
    ).toEqual({ ok: false, error: 'BAD_PAYLOAD' });
    expect(await send(socket, 'room:resume', { code: 'ABCDEF', token: 'x'.repeat(20) })).toEqual({
      ok: false,
      error: 'ROOM_NOT_FOUND',
    });
  });

  it('rate limit por conexión', async () => {
    const url = await start({ rateLimit: { capacity: 30, perSecond: 10 } });
    const socket = client(url);
    const replies = await Promise.all(
      Array.from({ length: 40 }, () => send(socket, 'room:join', { code: 'ABCDEF', name: 'x' })),
    );
    expect(replies.filter((r) => !r.ok && r.error === 'RATE_LIMITED').length).toBeGreaterThan(0);
  });

  it('espectadores y chat (M9): miran sin asiento, leen el chat y no pueden escribir', async () => {
    const url = await start();
    const host = client(url);
    const created = await send<{ session: Session }>(host, 'room:create', { name: 'Ana' });
    if (!created.ok) throw new Error(created.error);
    const { code } = created.session;

    const watcher = client(url);
    expect(await send(watcher, 'room:watch', { code })).toEqual({
      ok: false,
      error: 'GAME_NOT_STARTED',
    });
    expect(await send(watcher, 'room:watch', { code: 'ZZZZZZ' })).toEqual({
      ok: false,
      error: 'ROOM_NOT_FOUND',
    });

    expect((await send(host, 'lobby:addBot', { difficulty: 'easy' })).ok).toBe(true);
    expect(await send(host, 'chat:send', { text: '  Hola,\u0007 che  ' })).toEqual({ ok: true });
    expect(await send(host, 'chat:send', { emote: 'nada' })).toEqual({
      ok: false,
      error: 'BAD_PAYLOAD',
    });
    expect((await send(host, 'lobby:start')).ok).toBe(true);

    const history = new Promise<readonly ChatMessage[]>((resolve) => {
      watcher.once('chat:history', resolve);
    });
    const snapshot = new Promise<GameSnapshot>((resolve) => {
      watcher.once('game:snapshot', resolve);
    });
    expect(await send(watcher, 'room:watch', { code: code.toLowerCase() })).toEqual({ ok: true });
    expect((await history).map((message) => message.text)).toEqual(['Hola,  che']);
    const seen = await snapshot;
    expect(seen.view.viewerId).toBeNull();
    expect(seen.view.legal).toEqual([]);
    expect(seen.stats).toBeNull();

    const message = new Promise<ChatMessage>((resolve) => {
      watcher.once('chat:message', resolve);
    });
    expect(await send(host, 'chat:send', { emote: 'dale' })).toEqual({ ok: true });
    expect(await message).toMatchObject({ name: 'Ana', emote: 'dale', text: null });
    // El espectador no tiene asiento: no escribe, no juega.
    expect(await send(watcher, 'chat:send', { text: 'hola' })).toEqual({
      ok: false,
      error: 'NO_SESSION',
    });
    expect(await send(watcher, 'room:rematch')).toEqual({ ok: false, error: 'NO_SESSION' });
    // Y recibe las actualizaciones de la partida: el bot juega solo o, si
    // empieza Ana, ella tira.
    const update = new Promise<GameUpdate>((resolve) => {
      watcher.once('game:update', resolve);
    });
    if (seen.view.currentPlayerId === created.session.playerId) {
      await send(host, 'game:intent', {
        actionId: 'x1',
        expectedVersion: seen.view.version,
        action: { type: 'rollDice' },
      });
    }
    expect((await update).view.viewerId).toBeNull();
  });
});
