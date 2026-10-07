import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGameServer, type GameServer } from '../src/app.js';

let server: GameServer;
let url: string;

beforeAll(async () => {
  server = createGameServer({ allowedOrigins: ['http://localhost:5173'] });
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  const { port } = server.httpServer.address() as AddressInfo;
  url = `http://localhost:${port}`;
});

afterAll(async () => {
  await server.io.close();
});

describe('server', () => {
  it('responde /health', async () => {
    const response = await fetch(`${url}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, protocol: 1, tiles: 40 });
  });

  it('contesta el ping por socket', async () => {
    const socket: Socket = connect(url, { transports: ['websocket'] });
    try {
      const reply: unknown = await socket.timeout(5000).emitWithAck('ping');
      expect(reply).toEqual({ pong: true, protocol: 1 });
    } finally {
      socket.close();
    }
  });
});
