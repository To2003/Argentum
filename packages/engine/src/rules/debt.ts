import { BUILDING_RESALE_PERCENT, HOUSES_PER_HOTEL, tileAt } from '@gran-negocio/shared';
import type { Ctx } from '../context.js';
import { playerOf } from '../context.js';
import type { Debt, Party, PlayerId, TileIndex } from '../types.js';
import { returnJailCard } from './cards.js';
import { interestOnMortgaged } from './checks.js';
import { charge, transfer } from './money.js';

/**
 * Quiebra (SPEC.md §5.7, §15.4).
 *
 * - Ante un jugador: se lleva el efectivo, las propiedades y las "Salí gratis".
 *   Los edificios se le venden al banco a la mitad y esa plata va al acreedor.
 *   Por cada hipotecada que recibe paga el 10 % (`mortgageInterest`); si no le
 *   alcanza, queda él en deuda con el banco.
 * - Ante el banco o el pozo: el efectivo va al acreedor, las propiedades
 *   vuelven al banco sin edificios ni hipoteca y las "Salí gratis" al fondo de
 *   su mazo. Devuelve esas propiedades para subastarlas una por una.
 */
export function goBankrupt(ctx: Ctx, debtorId: PlayerId, creditor: Party): TileIndex[] {
  const { s } = ctx;
  const debtor = playerOf(s, debtorId);
  const toPlayer = creditor !== 'bank' && creditor !== 'pot';
  const toAuction: TileIndex[] = [];
  const received: TileIndex[] = [];
  if (s.trade !== null && (s.trade.from === debtorId || s.trade.to === debtorId)) {
    ctx.events.push({ type: 'tradeClosed', tradeId: s.trade.id, reason: 'invalidated' });
    s.trade = null;
  }

  for (const [key, owned] of Object.entries(s.properties)) {
    if (owned.ownerId !== debtorId) continue;
    const index = Number(key);
    if (owned.houses > 0) {
      const tile = tileAt(index);
      const houseCost = tile.kind === 'property' ? tile.houseCost : 0;
      const buildings = owned.houses === 5 ? HOUSES_PER_HOTEL + 1 : owned.houses;
      if (owned.houses === 5) s.bank.hotels += 1;
      else s.bank.houses += owned.houses;
      if (toPlayer) {
        const resale = Math.floor((buildings * houseCost * BUILDING_RESALE_PERCENT) / 100);
        transfer(ctx, 'bank', creditor, resale, 'bankruptcy');
      }
      owned.houses = 0;
    }
    if (toPlayer) {
      owned.ownerId = creditor;
      received.push(index);
    } else {
      // Borrar la entrada es devolverla al banco.
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete s.properties[index];
      toAuction.push(index);
    }
    ctx.events.push({
      type: 'propertyTransferred',
      tile: index,
      from: debtorId,
      to: toPlayer ? creditor : 'bank',
    });
  }

  for (const cardId of debtor.jailFreeCards) {
    if (toPlayer) playerOf(s, creditor).jailFreeCards.push(cardId);
    else returnJailCard(ctx, cardId);
    ctx.events.push({
      type: 'jailFreeCardTransferred',
      cardId,
      from: debtorId,
      to: toPlayer ? creditor : 'deck',
    });
  }
  debtor.jailFreeCards = [];

  transfer(ctx, debtorId, creditor, debtor.cash, 'bankruptcy');
  debtor.bankrupt = true;
  debtor.inJail = false;
  ctx.events.push({ type: 'playerBankrupt', playerId: debtorId, creditor });

  if (toPlayer) {
    const interest = interestOnMortgaged(s, received);
    charge(ctx, creditor, 'bank', interest, 'mortgageInterest');
  }
  return toAuction.sort((a, b) => a - b);
}

/** Paga la primera deuda de la cola con el efectivo que juntó. */
export function payDebt(ctx: Ctx, debt: Debt): void {
  transfer(ctx, debt.debtorId, debt.creditor, debt.amount, debt.reason);
  ctx.events.push({
    type: 'debtPaid',
    debtorId: debt.debtorId,
    creditor: debt.creditor,
    amount: debt.amount,
  });
}
