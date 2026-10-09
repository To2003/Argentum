import { COLOR_GROUPS, RulesOverridesSchema, TOKEN_IDS } from '@gran-negocio/shared';
import { z } from 'zod';

/**
 * Esquemas de todo lo que entra del cliente (SPEC.md §8: zod en cada mensaje).
 * Validan la forma; la legalidad la decide el engine.
 */

const Name = z
  .string()
  .transform((value) => value.replace(/\p{Cc}/gu, '').trim())
  .pipe(z.string().min(1).max(20));

const Code = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(z.string().regex(/^[A-Z2-9]{6}$/));

export const CreateRoomSchema = z.strictObject({ name: Name });
export const JoinRoomSchema = z.strictObject({ code: Code, name: Name });
export const ResumeSchema = z.strictObject({
  code: Code,
  token: z.string().min(10).max(64),
});
export const SetTokenSchema = z.strictObject({
  tokenId: z.enum(TOKEN_IDS as [string, ...string[]]),
});
export const SetReadySchema = z.strictObject({ ready: z.boolean() });
export const SetRulesSchema = z.strictObject({ rules: RulesOverridesSchema });
export const AddBotSchema = z.strictObject({ difficulty: z.enum(['easy', 'medium', 'hard']) });
export const RemoveBotSchema = z.strictObject({ playerId: z.string().min(1).max(64) });

const Tile = z.int().min(0).max(39);
const Bundle = z.strictObject({
  cash: z.int().min(0).max(1_000_000),
  properties: z.array(Tile).max(28),
  jailFreeCards: z.array(z.string().max(40)).max(2),
});

export const ActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('rollDice') }),
  z.strictObject({ type: z.literal('payJailFine') }),
  z.strictObject({ type: z.literal('useJailCard') }),
  z.strictObject({ type: z.literal('buyProperty') }),
  z.strictObject({ type: z.literal('declineProperty') }),
  z.strictObject({ type: z.literal('endTurn') }),
  z.strictObject({ type: z.literal('declareBankruptcy') }),
  z.strictObject({ type: z.literal('payDebt') }),
  z.strictObject({ type: z.literal('bid'), amount: z.int().min(1).max(1_000_000) }),
  z.strictObject({ type: z.literal('passAuction') }),
  z.strictObject({ type: z.literal('buildHouse'), tile: Tile }),
  z.strictObject({ type: z.literal('sellBuilding'), tile: Tile }),
  z.strictObject({ type: z.literal('sellAllBuildings'), group: z.enum(COLOR_GROUPS) }),
  z.strictObject({ type: z.literal('mortgage'), tile: Tile }),
  z.strictObject({ type: z.literal('unmortgage'), tile: Tile }),
  z.strictObject({
    type: z.literal('proposeTrade'),
    to: z.string().min(1).max(64),
    offer: Bundle,
    request: Bundle,
  }),
  z.strictObject({ type: z.literal('counterTrade'), offer: Bundle, request: Bundle }),
  z.strictObject({ type: z.literal('acceptTrade') }),
  z.strictObject({ type: z.literal('rejectTrade') }),
  z.strictObject({ type: z.literal('cancelTrade') }),
]);

/**
 * Un intent: la acción, un id para idempotencia y la versión del estado que el
 * cliente estaba mirando (si no coincide → STALE_STATE). `timeUp` no está: es
 * del actor `system`, nunca de un cliente.
 */
export const IntentSchema = z.strictObject({
  actionId: z.string().min(1).max(64),
  expectedVersion: z.int().min(0),
  action: ActionSchema,
});
