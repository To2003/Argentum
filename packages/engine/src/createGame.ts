import {
  BANK_HOTELS,
  BANK_HOUSES,
  DECKS,
  DEFAULT_RULES,
  MIN_PLAYERS,
  type RulesConfig,
} from '@gran-negocio/shared';
import { createCtx, type Ctx } from './context.js';
import type { GameEvent } from './events.js';
import { createRng, rollDice, shuffle, type Seed } from './rng.js';
import { startTurn } from './rules/turn.js';
import type { GameState, PlayerId, PlayerSetup } from './types.js';

/** Valores especiales de `Party` y de los eventos: no pueden ser ids de jugador. */
export const RESERVED_PLAYER_IDS: readonly string[] = ['bank', 'pot', 'deck', 'system'];

export interface GameSetup {
  /** 128 bits en hex, generado por el server con crypto. */
  readonly seed: Seed;
  /** En el orden en que se sentaron; el orden de turno lo deciden los dados. */
  readonly players: readonly PlayerSetup[];
  readonly rules?: RulesConfig;
}

/**
 * Arma la partida: baraja los mazos, define el orden de turno con los dados y
 * arranca el primer turno. Un setup inválido es un bug de quien llama (el
 * server valida el lobby antes), así que tira en vez de devolver un error.
 */
export function createGame(setup: GameSetup): { state: GameState; events: readonly GameEvent[] } {
  const rules = setup.rules ?? DEFAULT_RULES;
  const ids = setup.players.map((player) => player.id);
  if (ids.length < MIN_PLAYERS || ids.length > rules.maxPlayers) {
    throw new RangeError(`se necesitan entre ${MIN_PLAYERS} y ${rules.maxPlayers} jugadores`);
  }
  if (new Set(ids).size !== ids.length) throw new RangeError('ids de jugador repetidos');
  const reserved = ids.find((id) => RESERVED_PLAYER_IDS.includes(id));
  if (reserved !== undefined) throw new RangeError(`"${reserved}" es un id reservado`);

  let rngState = createRng(setup.seed);
  const chance = shuffle(
    rngState,
    DECKS.chance.map((card) => card.id),
  );
  rngState = chance.state;
  const community = shuffle(
    rngState,
    DECKS.community.map((card) => card.id),
  );
  rngState = community.state;

  const firstId = ids[0] as PlayerId;
  const state: GameState = {
    version: 0,
    rules: { ...rules },
    rngState,
    players: Object.fromEntries(
      setup.players.map((player) => [
        player.id,
        {
          id: player.id,
          name: player.name,
          tokenId: player.tokenId,
          cash: rules.startingCash,
          position: 0,
          inJail: false,
          jailAttempts: 0,
          jailFreeCards: [],
          bankrupt: false,
        },
      ]),
    ),
    turnOrder: [...ids],
    currentPlayerId: firstId,
    phase: { kind: 'waitingRoll' },
    turn: { doublesCount: 0, rollAgain: false, lastRoll: null },
    turnNumber: 1,
    round: 1,
    properties: {},
    bank: { houses: BANK_HOUSES, hotels: BANK_HOTELS },
    pot: 0,
    decks: { chance: chance.value, community: community.value },
    trade: null,
    nextTradeId: 1,
  };

  const ctx = createCtx(state);
  state.turnOrder = decideTurnOrder(ctx, ids);
  ctx.events.push({ type: 'turnOrderDecided', order: [...state.turnOrder] });
  startTurn(ctx, state.turnOrder[0] as PlayerId);
  return { state, events: ctx.events };
}

/**
 * SPEC.md §5.1: cada uno tira dos dados y se ordena de mayor a menor. Los
 * empatados vuelven a tirar solo entre ellos para ordenarse dentro de su lugar.
 */
function decideTurnOrder(ctx: Ctx, ids: readonly PlayerId[]): PlayerId[] {
  if (ids.length <= 1) return [...ids];
  const totals = new Map<PlayerId, number>();
  for (const playerId of ids) {
    const draw = rollDice(ctx.s.rngState);
    ctx.s.rngState = draw.state;
    ctx.events.push({ type: 'diceRolled', playerId, dice: draw.value, reason: 'turnOrder' });
    totals.set(playerId, draw.value[0] + draw.value[1]);
  }
  const distinct = [...new Set(totals.values())].sort((a, b) => b - a);
  return distinct.flatMap((total) =>
    decideTurnOrder(
      ctx,
      ids.filter((id) => totals.get(id) === total),
    ),
  );
}
