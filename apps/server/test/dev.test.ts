import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createGameServer, type GameServer } from '../src/app.js';
import { memoryStore } from '../src/persistence.js';

let server: GameServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

async function start(devRoutes: boolean, store = memoryStore()) {
  server = createGameServer({ allowedOrigins: [], devRoutes, store });
  await new Promise<void>((resolve) => server?.httpServer.listen(0, resolve));
  const { port } = server.httpServer.address() as AddressInfo;
  return `http://localhost:${port}`;
}

describe('escenarios de desarrollo', () => {
  it('sin devRoutes (producción) no existen', async () => {
    const url = await start(false);
    expect((await fetch(`${url}/dev/scenario/build`, { method: 'POST' })).status).toBe(404);
  });

  it('con devRoutes crean una partida armada que no se persiste', async () => {
    const store = memoryStore();
    const url = await start(true, store);
    const response = await fetch(`${url}/dev/scenario/build`, { method: 'POST' });
    const body = (await response.json()) as {
      ok: boolean;
      code: string;
      seats: { token: string }[];
    };
    expect(body.ok).toBe(true);
    expect(body.seats).toHaveLength(2);
    const room = server!.rooms.get(body.code)!;
    expect(room.state?.properties[1]?.ownerId).toBe('p1');
    expect(room.state?.currentPlayerId).toBe('p1');
    expect(store.loadRooms()).toEqual([]);
    expect((await fetch(`${url}/dev/scenario/nope`, { method: 'POST' })).status).toBe(404);
  });
});
