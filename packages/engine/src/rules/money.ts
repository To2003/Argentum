import type { Ctx } from '../context.js';
import { playerOf } from '../context.js';
import type { MoneyReason, Party, PlayerId, TileIndex } from '../types.js';

/** Razones de pago al banco que, con `freeParkingPot`, van al pozo (SPEC.md §15.4). */
const POT_REASONS: ReadonlySet<MoneyReason> = new Set(['tax', 'card', 'jailFine']);

/** El banco, o el pozo si la regla de la casa está activa y la razón corresponde. */
export const bankOrPot = (ctx: Ctx, reason: MoneyReason): 'bank' | 'pot' =>
  ctx.s.rules.freeParkingPot && POT_REASONS.has(reason) ? 'pot' : 'bank';

/**
 * Mueve plata entre jugadores, banco y pozo. Quien paga tiene que tener el
 * efectivo: chequearlo es trabajo de quien llama (o de `charge`).
 */
export function transfer(
  ctx: Ctx,
  from: Party,
  to: Party,
  amount: number,
  reason: MoneyReason,
  tile?: TileIndex,
): void {
  if (!Number.isInteger(amount) || amount < 0) throw new Error(`monto inválido: ${amount}`);
  if (amount === 0 || from === to) return;
  if (from === 'pot') {
    if (ctx.s.pot < amount) throw new Error('el pozo no alcanza');
    ctx.s.pot -= amount;
  } else if (from !== 'bank') {
    const payer = playerOf(ctx.s, from);
    if (payer.cash < amount) throw new Error(`${from} no tiene ${amount}`);
    payer.cash -= amount;
  }
  if (to === 'pot') ctx.s.pot += amount;
  else if (to !== 'bank') playerOf(ctx.s, to).cash += amount;
  ctx.events.push({
    type: 'moneyTransferred',
    from,
    to,
    amount,
    reason,
    ...(tile === undefined ? {} : { tile }),
  });
}

/**
 * Cobra si alcanza el efectivo; si no, abre una deuda y no toca nada más (no
 * hay pagos parciales: en una quiebra el acreedor se lleva todo). Devuelve si
 * pudo pagar.
 */
export function charge(
  ctx: Ctx,
  debtorId: PlayerId,
  creditor: Party,
  amount: number,
  reason: MoneyReason,
  tile?: TileIndex,
): boolean {
  if (amount === 0) return true;
  if (playerOf(ctx.s, debtorId).cash >= amount) {
    transfer(ctx, debtorId, creditor, amount, reason, tile);
    return true;
  }
  ctx.debts.push({ debtorId, creditor, amount, reason });
  ctx.events.push({ type: 'debtOpened', debtorId, creditor, amount, reason });
  return false;
}
