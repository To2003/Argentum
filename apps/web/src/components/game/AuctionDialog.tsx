import type { Action, PlayerView } from '@gran-negocio/engine';
import type { TimerState } from '@gran-negocio/server/protocol';
import { tileAt, tokenColor } from '@gran-negocio/shared';
import { useState } from 'react';
import { GROUP_COLORS } from '../../game/colors.js';
import { useSecondsLeft } from '../../game/useSecondsLeft.js';
import { i18n, t } from '../../i18n.js';
import { Button, Dialog, TokenBadge } from '../ui.js';

/**
 * La subasta (SPEC.md §5.2, §7.4): qué se subasta, quién va ganando, quién
 * sigue, la cuenta regresiva y la puja (con atajos de +$1, +$10 y +$50).
 */
export function AuctionDialog({
  view,
  timers,
  onAct,
  onClose,
}: {
  view: PlayerView;
  timers: readonly TimerState[];
  onAct: (action: Action) => void;
  onClose: () => void;
}) {
  const { phase } = view;
  const me = view.viewerId;
  const timer = timers.find((item) => item.kind === 'auction');
  const seconds = useSecondsLeft(timer?.deadline ?? null);
  const minAction = view.legal.find((action) => action.type === 'bid');
  const minBid = minAction?.type === 'bid' ? minAction.amount : null;
  const [amount, setAmount] = useState<number | null>(null);
  if (phase.kind !== 'auction') return null;

  const lotTile = tileAt(phase.lot.tile);
  const title =
    phase.lot.kind === 'property'
      ? i18n.tileName(lotTile, view.rules.useRealBrands)
      : t(phase.lot.building === 'hotel' ? 'building.hotel' : 'building.house');
  const myCash = view.players.find((player) => player.id === me)?.cash ?? 0;
  const value = Math.max(amount ?? 0, minBid ?? 0);
  const canPass = view.legal.some((action) => action.type === 'passAuction');
  const leading = phase.highBidder === me && me !== null;

  return (
    <Dialog title={t('prompt.auction', { lot: title })} onClose={onClose}>
      {lotTile.kind === 'property' && phase.lot.kind === 'property' && (
        <div
          className="-mx-5 -mt-4 mb-4 h-3"
          style={{ backgroundColor: GROUP_COLORS[lotTile.group] }}
        />
      )}
      <p
        className="font-display text-2xl font-extrabold"
        aria-live="polite"
        data-testid="auction-high"
      >
        {leading
          ? t('auction.youLead', { amount: i18n.money(phase.highBid) })
          : phase.highBidder === null
            ? t('prompt.auctionNoBids')
            : t('prompt.auctionHigh', {
                name: view.players.find((p) => p.id === phase.highBidder)?.name ?? '',
                amount: i18n.money(phase.highBid),
              })}
      </p>
      {seconds !== null && (
        <p
          className={`mt-1 tabular-nums ${seconds <= 3 ? 'font-bold text-fileteado' : 'text-tinta/70'}`}
        >
          {t('auction.closesIn', { seconds })}
        </p>
      )}

      <h3 className="mt-4 mb-1 font-bold">{t('auction.participants')}</h3>
      <ul className="mb-4 flex flex-wrap gap-2">
        {view.players
          .filter((player) => !player.bankrupt)
          .map((player) => {
            const inside = phase.participants.includes(player.id);
            return (
              <li
                key={player.id}
                className={`flex items-center gap-1.5 rounded-full bg-superficie px-2 py-1 text-sm ${inside ? '' : 'opacity-50'}`}
              >
                <TokenBadge
                  color={tokenColor(player.tokenId)}
                  tokenId={player.tokenId}
                  label={player.name}
                  size="1.2rem"
                />
                {player.name}
                {player.id === phase.highBidder && (
                  <span className="font-bold">({t('auction.leading')})</span>
                )}
                {!inside && <span>({t('auction.passed')})</span>}
              </li>
            );
          })}
      </ul>

      {minBid !== null ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onAct({ type: 'bid', amount: value });
            setAmount(null);
          }}
        >
          <label className="flex flex-col gap-1 font-bold">
            {t('auction.amount')}
            <input
              type="number"
              inputMode="numeric"
              min={minBid}
              max={myCash}
              step={1}
              value={value}
              data-testid="bid-amount"
              onChange={(event) => {
                setAmount(Number(event.target.value));
              }}
              className="rounded-xl border-2 border-tinta/30 bg-superficie px-3 py-2 text-2xl font-normal tabular-nums"
            />
          </label>
          <div className="flex gap-2">
            {[1, 10, 50].map((step) => (
              <Button
                key={step}
                variant="secondary"
                disabled={value + step > myCash}
                onClick={() => {
                  // Suma al monto actual, sin bajar del mínimo ni pasarse del efectivo.
                  setAmount(Math.min(myCash, Math.max(minBid, value + step)));
                }}
              >
                +{i18n.money(step)}
              </Button>
            ))}
          </div>
          <p className="text-sm text-tinta/70">
            {t('auction.minimum', { amount: i18n.money(minBid) })}
          </p>
          <div className="flex gap-2">
            <Button type="submit" disabled={value < minBid || value > myCash} data-testid="bid">
              {t('action.bid', { amount: i18n.money(value) })}
            </Button>
            {canPass && (
              <Button
                variant="secondary"
                onClick={() => {
                  onAct({ type: 'passAuction' });
                }}
              >
                {t('action.passAuction')}
              </Button>
            )}
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-2">
          {me !== null && !phase.participants.includes(me) && <p>{t('prompt.auctionOut')}</p>}
          {canPass && (
            <>
              <p>{t('auction.cantAfford')}</p>
              <Button
                variant="secondary"
                onClick={() => {
                  onAct({ type: 'passAuction' });
                }}
              >
                {t('action.passAuction')}
              </Button>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
