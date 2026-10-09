import { createRequire } from 'node:module';
import type { Action, BotDifficulty, PlayerId } from '@gran-negocio/engine';
import type { RulesConfig } from '@gran-negocio/shared';
import type { RoomStatus } from './protocol.js';

/**
 * Persistencia: `seed + acciones[]` por sala (SPEC.md §3.1, §15.1).
 *
 * Es la partida entera: reaplicar las acciones desde el seed reconstruye el
 * estado exacto, así que no se guarda estado derivado y un reinicio no puede
 * contradecirse con lo que guardó.
 *
 * **`node:sqlite`** (viene con Node, sin módulo nativo que compilar). Se carga
 * con `createRequire`: esbuild no conoce todos los builtins nuevos y reescribía
 * `import 'node:sqlite'` (lección de Tierra Austral).
 */
const require = createRequire(import.meta.url);

export interface StoredSeat {
  readonly playerId: PlayerId;
  readonly name: string;
  readonly tokenId: string | null;
  readonly ready: boolean;
  readonly token: string;
  readonly isBot: boolean;
  /** Dificultad del bot (las salas guardadas antes de M8 no la tienen). */
  readonly bot?: BotDifficulty | null;
  readonly joined: number;
}

export interface StoredRoom {
  readonly code: string;
  readonly hostId: PlayerId;
  readonly status: RoomStatus;
  /** Secreto: nunca sale del server. */
  readonly seed: string | null;
  readonly rules: RulesConfig;
  readonly createdAt: number;
  readonly lastActivity: number;
  /** Cuándo arrancó la partida (para la partida corta por tiempo). */
  readonly startedAt: number | null;
  readonly seats: readonly StoredSeat[];
}

export interface LoggedAction {
  readonly playerId: PlayerId;
  readonly action: Action;
}

export interface Store {
  saveRoom(room: StoredRoom): void;
  appendAction(code: string, index: number, entry: LoggedAction): void;
  /** Borra las acciones (revancha: arranca una partida nueva en la misma sala). */
  clearActions(code: string): void;
  loadRooms(): { room: StoredRoom; actions: LoggedAction[] }[];
  deleteRoom(code: string): void;
  close(): void;
}

export function memoryStore(): Store {
  const rooms = new Map<string, StoredRoom>();
  const actions = new Map<string, LoggedAction[]>();
  return {
    saveRoom: (room) => rooms.set(room.code, room),
    appendAction: (code, index, entry) => {
      const list = actions.get(code) ?? [];
      list[index] = entry;
      actions.set(code, list);
    },
    clearActions: (code) => actions.delete(code),
    loadRooms: () =>
      [...rooms.values()].map((room) => ({ room, actions: [...(actions.get(room.code) ?? [])] })),
    deleteRoom: (code) => {
      rooms.delete(code);
      actions.delete(code);
    },
    close: () => undefined,
  };
}

interface Statement {
  run(...params: (string | number | null)[]): unknown;
  all(...params: (string | number | null)[]): unknown[];
}
interface Database {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
}
type DatabaseConstructor = new (path: string) => Database;

export function sqliteStore(path: string): Store {
  const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: DatabaseConstructor };
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS actions (
      code TEXT NOT NULL,
      idx INTEGER NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (code, idx)
    );
  `);
  const upsertRoom = db.prepare(
    'INSERT INTO rooms (code, data) VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET data = excluded.data',
  );
  const insertAction = db.prepare(
    'INSERT OR REPLACE INTO actions (code, idx, data) VALUES (?, ?, ?)',
  );
  const deleteActions = db.prepare('DELETE FROM actions WHERE code = ?');
  const deleteRoomRow = db.prepare('DELETE FROM rooms WHERE code = ?');
  const selectRooms = db.prepare('SELECT code, data FROM rooms');
  const selectActions = db.prepare('SELECT data FROM actions WHERE code = ? ORDER BY idx');

  return {
    saveRoom: (room) => upsertRoom.run(room.code, JSON.stringify(room)),
    appendAction: (code, index, entry) => insertAction.run(code, index, JSON.stringify(entry)),
    clearActions: (code) => deleteActions.run(code),
    loadRooms: () =>
      (selectRooms.all() as { code: string; data: string }[]).map((row) => ({
        room: JSON.parse(row.data) as StoredRoom,
        actions: (selectActions.all(row.code) as { data: string }[]).map(
          (action) => JSON.parse(action.data) as LoggedAction,
        ),
      })),
    deleteRoom: (code) => {
      deleteActions.run(code);
      deleteRoomRow.run(code);
    },
    close: () => {
      db.close();
    },
  };
}
