import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_RULES } from '@gran-negocio/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { sqliteStore, type StoredRoom } from '../src/persistence.js';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const room: StoredRoom = {
  code: 'ABCDEF',
  hostId: 'p1',
  status: 'playing',
  seed: '0123456789abcdef0123456789abcdef',
  rules: DEFAULT_RULES,
  createdAt: 1,
  lastActivity: 2,
  startedAt: 3,
  seats: [
    {
      playerId: 'p1',
      name: 'Ana',
      tokenId: 'mate',
      ready: true,
      token: 'secreto',
      isBot: false,
      joined: 1,
    },
  ],
};

describe('sqliteStore', () => {
  it('guarda y trae salas y acciones en orden, entre aperturas', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gran-negocio-'));
    dirs.push(dir);
    const path = join(dir, 'test.db');
    const first = sqliteStore(path);
    first.saveRoom(room);
    first.appendAction('ABCDEF', 0, { playerId: 'p1', action: { type: 'rollDice' } });
    first.appendAction('ABCDEF', 1, { playerId: 'p1', action: { type: 'endTurn' } });
    first.saveRoom({ ...room, lastActivity: 9 });
    first.close();

    const second = sqliteStore(path);
    expect(second.loadRooms()).toEqual([
      {
        room: { ...room, lastActivity: 9 },
        actions: [
          { playerId: 'p1', action: { type: 'rollDice' } },
          { playerId: 'p1', action: { type: 'endTurn' } },
        ],
      },
    ]);
    second.clearActions('ABCDEF');
    expect(second.loadRooms()[0]?.actions).toEqual([]);
    second.deleteRoom('ABCDEF');
    expect(second.loadRooms()).toEqual([]);
    second.close();
  });
});
