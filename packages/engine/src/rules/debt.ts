import { BUILDING_RESALE_PERCENT, HOUSES_PER_HOTEL, tileAt } from '@gran-negocio/shared';
import type { Ctx } from '../context.js';
import { playerOf } from '../context.js';
import type { Party, PlayerId } from '../types.js';
import { returnJailCard } from './cards.js';
import { transfer } from './money.js';

/**
 * Quiebra (SPEC.md §5.7, versión mínima de M2; ver §15.4).
 *
 * - Ante un jugador: se lleva el efectivo, las propiedades y las "Salí gratis".
 *   Los edificios se le venden al banco a la mitad y esa plata va al acreedor.
 *   TODO(M3): el acreedor paga el 10 % (`mortgageInterest`) de las hipotecadas.
 * - Ante el banco o el pozo: el efectivo va al acreedor, las propiedades
 *   vuelven al banco sin edificios y las "Salí gratis" al fondo de su mazo.
 *   TODO(M3): subastar esas propiedades una por una.
 */
export function goBankrupt(ctx: Ctx, debtorId: PlayerId, creditor: Party): void {
  const { s } = ctx;
  const debtor = playerOf(s, debtorId);
  const toPlayer = creditor !== 'bank' && creditor !== 'pot';

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
    } else {
      // Exhaustividad de Record: borrar la entrada es devolverla al banco.
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete s.properties[index];
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
}
