import type { Action, PlayerView } from '@gran-negocio/engine';
import type { TimerState } from '@gran-negocio/server/protocol';
import { BOARD, isOwnable, tileAt } from '@gran-negocio/shared';
import { useEffect, useState } from 'react';
import { i18n, t } from '../../i18n.js';
import { Button, Dialog } from '../ui.js';

/** Acciones que se muestran como botones acá (las de una casilla van en su detalle). */
const PANEL_ACTIONS = new Set<Action['type']>([
  'rollDice',
  'payJailFine',
  'useJailCard',
  'buyProperty',
  'declineProperty',
  'payDebt',
  'endTurn',
  'passAuction',
  'acceptTrade',
  'rejectTrade',
  'cancelTrade',
  'declareBankruptcy',
]);

/** Segundos que faltan para un deadline, actualizado cada medio segundo. */
function useSecondsLeft(deadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return undefined;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => {
      clearInterval(timer);
    };
  }, [deadline]);
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
}

/**
 * El panel contextual (SPEC.md §7.4.3): qué está pasando y solo lo que el
 * jugador puede hacer ahora.
 */
export function ActionPanel({
  view,
  timers,
  onAct,
}: {
  view: PlayerView;
  timers: readonly TimerState[];
  onAct: (action: Action) => void;
}) {
  const me = view.viewerId;
  const name = (id: string) => view.players.find((p) => p.id === id)?.name ?? id;
  const tileName = (index: number) => {
    const tile = BOARD[index];
    return tile === undefined ? '' : i18n.tileName(tile, view.rules.useRealBrands);
  };
  const [confirmBankruptcy, setConfirmBankruptcy] = useState(false);
  // La puja mínima viene en las acciones legales (legalActions devuelve la mínima).
  const minBidAction = view.legal.find((action) => action.type === 'bid');
  const minBid = minBidAction?.type === 'bid' ? minBidAction.amount : null;
  const [bid, setBid] = useState<number | null>(null);
  const myCash = view.players.find((p) => p.id === me)?.cash ?? 0;

  const myTimer = timers.find((timer) => me !== null && timer.playerIds.includes(me));
  const anyTimer = myTimer ?? timers.find((timer) => timer.kind !== 'game');
  const secondsLeft = useSecondsLeft(anyTimer?.deadline ?? null);

  const { phase } = view;
  let prompt: string;
  switch (phase.kind) {
    case 'awaitingPurchase':
      prompt =
        view.currentPlayerId === me
          ? t('prompt.awaitingPurchase', { tile: tileName(phase.tile) })
          : t('game.waitingFor', { name: name(view.currentPlayerId) });
      break;
    case 'auction': {
      const lot =
        phase.lot.kind === 'property'
          ? tileName(phase.lot.tile)
          : t(phase.lot.building === 'hotel' ? 'building.hotel' : 'building.house');
      prompt = t('prompt.auction', { lot });
      break;
    }
    case 'inDebt': {
      const debt = phase.debts[0];
      const creditor = (party: string) =>
        party === 'bank' ? t('party.bank') : party === 'pot' ? t('party.pot') : name(party);
      prompt =
        debt === undefined
          ? ''
          : debt.debtorId === me
            ? `${t('prompt.inDebt', { amount: i18n.money(debt.amount), creditor: creditor(debt.creditor) })} ${t('game.debtHint')}`
            : t('prompt.inDebtOther', {
                name: name(debt.debtorId),
                amount: i18n.money(debt.amount),
              });
      break;
    }
    case 'jailDecision':
      prompt =
        view.currentPlayerId === me
          ? t('prompt.jail')
          : t('game.waitingFor', { name: name(view.currentPlayerId) });
      break;
    case 'gameOver':
      prompt = '';
      break;
    default:
      prompt =
        me === null
          ? t('game.spectating')
          : view.currentPlayerId === me
            ? t('game.yourTurn')
            : t('game.turnOf', { name: name(view.currentPlayerId) });
  }

  const label = (action: Action): string => {
    switch (action.type) {
      case 'payJailFine':
        return t('action.payJailFine', { amount: i18n.money(view.rules.jailFine) });
      case 'buyProperty': {
        if (phase.kind !== 'awaitingPurchase') return '';
        const tile = tileAt(phase.tile);
        return t('action.buyProperty', { amount: i18n.money(isOwnable(tile) ? tile.price : 0) });
      }
      case 'payDebt':
        return t('action.payDebt', {
          amount: i18n.money(phase.kind === 'inDebt' ? (phase.debts[0]?.amount ?? 0) : 0),
        });
      default:
        return t(`action.${action.type}` as 'action.rollDice');
    }
  };

  const actions = view.legal.filter((action) => PANEL_ACTIONS.has(action.type));
  const bidValue = bid ?? minBid ?? 0;

  return (
    <section
      aria-label={t('game.round', { round: view.round })}
      className="rounded-xl bg-white p-4"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p
          className="font-display text-lg font-extrabold leading-snug"
          aria-live="polite"
          data-testid="prompt"
        >
          {prompt}
        </p>
        {secondsLeft !== null && (
          <span
            className={`shrink-0 tabular-nums ${secondsLeft <= 10 ? 'font-bold text-fileteado' : 'text-tinta/70'}`}
          >
            {t('game.timeLeft', { seconds: secondsLeft })}
          </span>
        )}
      </div>

      {phase.kind === 'auction' && (
        <div className="mb-3 rounded-lg bg-celeste-claro p-3">
          <p className="mb-2">
            {phase.highBidder === null
              ? t('prompt.auctionNoBids')
              : t('prompt.auctionHigh', {
                  name: name(phase.highBidder),
                  amount: i18n.money(phase.highBid),
                })}
          </p>
          {minBid !== null ? (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                onAct({ type: 'bid', amount: bidValue });
                setBid(null);
              }}
            >
              <label className="flex flex-col text-sm">
                {t('auction.amount')}
                <input
                  type="number"
                  inputMode="numeric"
                  min={minBid}
                  max={myCash}
                  step={1}
                  value={bidValue}
                  onChange={(event) => {
                    setBid(Number(event.target.value));
                  }}
                  className="w-32 rounded-lg border-2 border-tinta/30 bg-white px-2 py-1.5 text-lg tabular-nums"
                />
              </label>
              <Button type="submit" disabled={bidValue < minBid || bidValue > myCash}>
                {t('action.bid', { amount: i18n.money(bidValue) })}
              </Button>
              <span className="text-sm text-tinta/70">
                {t('auction.minimum', { amount: i18n.money(minBid) })}
              </span>
            </form>
          ) : (
            me !== null &&
            !phase.participants.includes(me) && (
              <p className="text-sm text-tinta/70">{t('prompt.auctionOut')}</p>
            )
          )}
        </div>
      )}

      {view.trade !== null && (
        <p className="mb-3 rounded-lg bg-celeste-claro p-3">
          {t('prompt.trade', { from: name(view.trade.from), to: name(view.trade.to) })}
        </p>
      )}

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="actions">
          {actions.map((action) => (
            <Button
              key={action.type}
              data-action={action.type}
              variant={
                action.type === 'declareBankruptcy'
                  ? 'danger'
                  : action.type === 'declineProperty' ||
                      action.type === 'passAuction' ||
                      action.type === 'rejectTrade' ||
                      action.type === 'cancelTrade'
                    ? 'secondary'
                    : 'primary'
              }
              onClick={() => {
                if (action.type === 'declareBankruptcy') setConfirmBankruptcy(true);
                else onAct(action);
              }}
            >
              {label(action)}
            </Button>
          ))}
        </div>
      )}
      {phase.kind !== 'gameOver' && me !== null && (
        <p className="mt-3 text-sm text-tinta/60">{t('game.tapHint')}</p>
      )}

      {confirmBankruptcy && (
        <Dialog
          title={t('action.declareBankruptcy')}
          onClose={() => {
            setConfirmBankruptcy(false);
          }}
        >
          <p className="mb-4">{t('action.confirmBankruptcy')}</p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={() => {
                setConfirmBankruptcy(false);
                onAct({ type: 'declareBankruptcy' });
              }}
            >
              {t('action.confirm')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmBankruptcy(false);
              }}
            >
              {t('action.cancel')}
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
