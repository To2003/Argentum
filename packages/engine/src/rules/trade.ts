import type { Ctx } from '../context.js';
import { ownedAt, playerOf } from '../context.js';
import type { ErrorCode, PlayerId, ReadonlyGameState, TradeBundle, TradeState } from '../types.js';
import { blockedByBuildings, interestOnMortgaged, isTileIndex } from './checks.js';
import { bankOrPot, transfer } from './money.js';
import { isOwnable, tileAt } from '@gran-negocio/shared';

/** Lo que tiene que valer un lado del trueque: que `giver` lo tenga hoy. */
function bundleError(
  state: ReadonlyGameState,
  giver: PlayerId,
  bundle: TradeBundle,
): ErrorCode | null {
  const player = state.players[giver];
  if (player === undefined) return 'UNKNOWN_PLAYER';
  if (!Number.isInteger(bundle.cash) || bundle.cash < 0) return 'INVALID_TRADE';
  if (bundle.cash > player.cash) return 'INSUFFICIENT_FUNDS';
  if (new Set(bundle.properties).size !== bundle.properties.length) return 'INVALID_TRADE';
  for (const tile of bundle.properties) {
    if (!isTileIndex(tile) || !isOwnable(tileAt(tile))) return 'INVALID_TILE';
    if (state.properties[tile]?.ownerId !== giver) return 'NOT_OWNER';
    // Sin edificios en todo el grupo: hay que venderlos antes (SPEC.md §5.6).
    if (blockedByBuildings(state, tile)) return 'HAS_BUILDINGS';
  }
  if (new Set(bundle.jailFreeCards).size !== bundle.jailFreeCards.length) return 'INVALID_TRADE';
  for (const cardId of bundle.jailFreeCards) {
    if (!player.jailFreeCards.includes(cardId)) return 'NO_JAIL_CARD';
  }
  return null;
}

const isEmpty = (bundle: TradeBundle) =>
  bundle.cash === 0 && bundle.properties.length === 0 && bundle.jailFreeCards.length === 0;

/**
 * Valida el contenido de un trueque (no quién lo propone ni cuándo). Cada lado
 * tiene que poder pagar el 10 % de las hipotecadas que recibe con lo que le
 * queda después del intercambio: así aceptar nunca abre una deuda.
 */
export function tradeContentError(
  state: ReadonlyGameState,
  from: PlayerId,
  to: PlayerId,
  offer: TradeBundle,
  request: TradeBundle,
): ErrorCode | null {
  const target = state.players[to];
  if (target === undefined) return 'UNKNOWN_PLAYER';
  if (from === to || target.bankrupt) return 'INVALID_TRADE';
  if (isEmpty(offer) && isEmpty(request)) return 'INVALID_TRADE';
  const offerError = bundleError(state, from, offer);
  if (offerError !== null) return offerError;
  const requestError = bundleError(state, to, request);
  if (requestError !== null) return requestError;
  const fromCash = (state.players[from]?.cash ?? 0) - offer.cash + request.cash;
  const toCash = target.cash - request.cash + offer.cash;
  if (fromCash < interestOnMortgaged(state, request.properties)) return 'INSUFFICIENT_FUNDS';
  if (toCash < interestOnMortgaged(state, offer.properties)) return 'INSUFFICIENT_FUNDS';
  return null;
}

const copyBundle = (bundle: TradeBundle): TradeBundle => ({
  cash: bundle.cash,
  properties: [...bundle.properties],
  jailFreeCards: [...bundle.jailFreeCards],
});

export function proposeTrade(
  ctx: Ctx,
  from: PlayerId,
  to: PlayerId,
  offer: TradeBundle,
  request: TradeBundle,
  counter: boolean,
): void {
  const trade: TradeState = {
    id: ctx.s.nextTradeId,
    from,
    to,
    offer: copyBundle(offer),
    request: copyBundle(request),
  };
  ctx.s.nextTradeId += 1;
  ctx.s.trade = trade;
  ctx.events.push({
    type: 'tradeProposed',
    tradeId: trade.id,
    from,
    to,
    offer: copyBundle(offer),
    request: copyBundle(request),
    counter,
  });
}

export function closeTrade(ctx: Ctx, reason: 'rejected' | 'cancelled' | 'invalidated'): void {
  const trade = ctx.s.trade;
  if (trade === null) return;
  ctx.events.push({ type: 'tradeClosed', tradeId: trade.id, reason });
  ctx.s.trade = null;
}

/** Entrega un lado: plata, propiedades (con su hipoteca) y cartas. */
function give(ctx: Ctx, from: PlayerId, to: PlayerId, bundle: TradeBundle): void {
  transfer(ctx, from, to, bundle.cash, 'trade');
  for (const tile of bundle.properties) {
    ownedAt(ctx.s, tile).ownerId = to;
    ctx.events.push({ type: 'propertyTransferred', tile, from, to });
  }
  const giver = playerOf(ctx.s, from);
  for (const cardId of bundle.jailFreeCards) {
    giver.jailFreeCards = giver.jailFreeCards.filter((id) => id !== cardId);
    playerOf(ctx.s, to).jailFreeCards.push(cardId);
    ctx.events.push({ type: 'jailFreeCardTransferred', cardId, from, to });
  }
}

/**
 * Acepta: intercambia todo y cada uno paga el 10 % de las hipotecadas que
 * recibe (SPEC.md §5.5). Quedan hipotecadas; levantarlas después cuesta el
 * valor + 10 % otra vez (SPEC.md §15.5).
 */
export function acceptTrade(ctx: Ctx): void {
  const trade = ctx.s.trade;
  if (trade === null) throw new Error('no hay trueque');
  const interestFrom = interestOnMortgaged(ctx.s, trade.request.properties);
  const interestTo = interestOnMortgaged(ctx.s, trade.offer.properties);
  give(ctx, trade.from, trade.to, trade.offer);
  give(ctx, trade.to, trade.from, trade.request);
  transfer(ctx, trade.from, bankOrPot(ctx, 'mortgageInterest'), interestFrom, 'mortgageInterest');
  transfer(ctx, trade.to, bankOrPot(ctx, 'mortgageInterest'), interestTo, 'mortgageInterest');
  ctx.events.push({ type: 'tradeAccepted', tradeId: trade.id });
  ctx.s.trade = null;
}
