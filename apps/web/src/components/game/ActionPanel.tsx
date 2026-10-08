import { actorOf, PHASE_ACTIONS, type Action, type PlayerView } from '@gran-negocio/engine';
import type { TimerState } from '@gran-negocio/server/protocol';
import { BOARD, isOwnable, tileAt } from '@gran-negocio/shared';
import { useState } from 'react';
import { useSecondsLeft } from '../../game/useSecondsLeft.js';
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
  'declareBankruptcy',
]);

export type PanelDialog = 'auction' | 'trade' | 'manage';

/**
 * El panel contextual (SPEC.md §7.4.3): qué está pasando y solo lo que el
 * jugador puede hacer ahora. Subasta, trueque y propiedades se abren en sus
 * diálogos.
 */
export function ActionPanel({
  view,
  timers,
  onAct,
  onOpen,
}: {
  view: PlayerView;
  timers: readonly TimerState[];
  onAct: (action: Action) => void;
  onOpen: (dialog: PanelDialog) => void;
}) {
  const me = view.viewerId;
  const name = (id: string) => view.players.find((p) => p.id === id)?.name ?? id;
  const tileName = (index: number) => {
    const tile = BOARD[index];
    return tile === undefined ? '' : i18n.tileName(tile, view.rules.useRealBrands);
  };
  const [confirmBankruptcy, setConfirmBankruptcy] = useState(false);

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
  // Proponer no está en `legal` (es combinatorio): se puede si la fase lo
  // permite, actúa el viewer y no hay otro trueque abierto. El contenido lo
  // valida el editor, con las reglas del engine.
  const canPropose =
    me !== null &&
    view.trade === null &&
    PHASE_ACTIONS[phase.kind].includes('proposeTrade') &&
    actorOf(view) === me;
  const ownsSomething =
    me !== null && Object.values(view.properties).some((property) => property.ownerId === me);

  return (
    <section
      aria-label={t('game.round', { round: view.round })}
      className="rounded-xl bg-superficie p-4"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p
          className="font-display text-lg leading-snug font-extrabold"
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-celeste-claro p-3">
          <p>
            {phase.highBidder === null
              ? t('prompt.auctionNoBids')
              : t('prompt.auctionHigh', {
                  name: name(phase.highBidder),
                  amount: i18n.money(phase.highBid),
                })}
          </p>
          <Button
            variant="secondary"
            data-testid="view-auction"
            onClick={() => {
              onOpen('auction');
            }}
          >
            {t('auction.view')}
          </Button>
        </div>
      )}

      {view.trade !== null && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-celeste-claro p-3">
          <p>{t('prompt.trade', { from: name(view.trade.from), to: name(view.trade.to) })}</p>
          <Button
            variant="secondary"
            data-testid="view-trade"
            onClick={() => {
              onOpen('trade');
            }}
          >
            {t('trade.view')}
          </Button>
        </div>
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
                  : action.type === 'declineProperty'
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

      {(canPropose || ownsSomething) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {ownsSomething && (
            <Button
              variant="secondary"
              data-testid="open-manage"
              onClick={() => {
                onOpen('manage');
              }}
            >
              {t('manage.open')}
            </Button>
          )}
          {canPropose && (
            <Button
              variant="secondary"
              data-testid="open-trade"
              onClick={() => {
                onOpen('trade');
              }}
            >
              {t('trade.open')}
            </Button>
          )}
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
