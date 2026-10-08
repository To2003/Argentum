import {
  blockedByBuildings,
  mortgageInterest,
  tradeContentError,
  type Action,
  type PlayerView,
  type TradeBundle,
} from '@gran-negocio/engine';
import type { TimerState } from '@gran-negocio/server/protocol';
import { BOARD, isOwnable, tileAt, tokenColor } from '@gran-negocio/shared';
import { useState } from 'react';
import { GROUP_COLORS } from '../../game/colors.js';
import { reasonText } from '../../game/reasonText.js';
import { rulesView } from '../../game/rulesView.js';
import { useSecondsLeft } from '../../game/useSecondsLeft.js';
import { i18n, t } from '../../i18n.js';
import { Button, Dialog, TokenBadge } from '../ui.js';

const EMPTY: TradeBundle = { cash: 0, properties: [], jailFreeCards: [] };

type Props = {
  view: PlayerView;
  timers: readonly TimerState[];
  onAct: (action: Action) => void;
  onClose: () => void;
};

/**
 * Trueques (SPEC.md §5.6): si hay uno abierto se muestra (con aceptar,
 * rechazar, contraofertar o retirar según el rol); si no, el editor para
 * proponer. La validación es en vivo y con las reglas del engine.
 */
export function TradeDialog(props: Props) {
  const { view } = props;
  const [composing, setComposing] = useState<{
    counter: boolean;
    to: string;
    offer: TradeBundle;
    request: TradeBundle;
  } | null>(null);
  if (view.trade === null || composing !== null) {
    return (
      <TradeEditor
        {...props}
        initial={
          composing ?? {
            counter: false,
            to: view.players.find((p) => p.id !== view.viewerId && !p.bankrupt)?.id ?? '',
            offer: EMPTY,
            request: EMPTY,
          }
        }
      />
    );
  }
  const { trade } = view;
  return (
    <TradeReview
      {...props}
      onCounter={() => {
        setComposing({ counter: true, to: trade.from, offer: trade.request, request: trade.offer });
      }}
    />
  );
}

function TradeReview({
  view,
  timers,
  onAct,
  onClose,
  onCounter,
}: Props & { onCounter: () => void }) {
  const trade = view.trade;
  const timer = timers.find((item) => item.kind === 'trade');
  const seconds = useSecondsLeft(timer?.deadline ?? null);
  if (trade === null) return null;
  const me = view.viewerId;
  const name = (id: string) => view.players.find((p) => p.id === id)?.name ?? id;
  const acceptError =
    me === trade.to
      ? tradeContentError(rulesView(view), trade.from, trade.to, trade.offer, trade.request)
      : null;
  const can = (type: Action['type']) => view.legal.some((action) => action.type === type);
  const title =
    me === trade.to
      ? t('trade.incoming', { name: name(trade.from) })
      : me === trade.from
        ? t('trade.outgoing', { name: name(trade.to) })
        : t('trade.between', { from: name(trade.from), to: name(trade.to) });

  return (
    <Dialog title={t('trade.title')} onClose={onClose}>
      <p className="mb-1 font-display text-xl font-extrabold" data-testid="trade-title">
        {title}
      </p>
      {seconds !== null && (
        <p className="mb-3 text-sm tabular-nums text-tinta/70">
          {t('trade.expiresIn', { seconds })}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <BundleSummary
          view={view}
          title={t('trade.theyGive', { name: name(trade.from) })}
          bundle={trade.offer}
        />
        <BundleSummary
          view={view}
          title={t('trade.theyGive', { name: name(trade.to) })}
          bundle={trade.request}
        />
      </div>
      {acceptError !== null && (
        <p className="mt-3 font-bold text-fileteado">{reasonText(acceptError)}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {can('acceptTrade') && (
          <Button
            data-testid="accept-trade"
            disabled={acceptError !== null}
            onClick={() => {
              onAct({ type: 'acceptTrade' });
              onClose();
            }}
          >
            {t('action.acceptTrade')}
          </Button>
        )}
        {can('rejectTrade') && (
          <>
            <Button variant="secondary" onClick={onCounter}>
              {t('trade.counter')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                onAct({ type: 'rejectTrade' });
                onClose();
              }}
            >
              {t('action.rejectTrade')}
            </Button>
          </>
        )}
        {can('cancelTrade') && (
          <Button
            variant="secondary"
            onClick={() => {
              onAct({ type: 'cancelTrade' });
              onClose();
            }}
          >
            {t('action.cancelTrade')}
          </Button>
        )}
      </div>
    </Dialog>
  );
}

function BundleSummary({
  view,
  title,
  bundle,
}: {
  view: PlayerView;
  title: string;
  bundle: TradeBundle;
}) {
  const empty =
    bundle.cash === 0 && bundle.properties.length === 0 && bundle.jailFreeCards.length === 0;
  return (
    <section className="rounded-xl bg-superficie p-3">
      <h3 className="mb-2 font-bold">{title}</h3>
      {empty ? (
        <p className="text-tinta/60">{t('trade.none')}</p>
      ) : (
        <ul className="space-y-1">
          {bundle.cash > 0 && <li className="font-bold tabular-nums">{i18n.money(bundle.cash)}</li>}
          {bundle.properties.map((index) => (
            <PropertyLine key={index} view={view} index={index} />
          ))}
          {bundle.jailFreeCards.map((card) => (
            <li key={card}>{t('trade.jailCards')}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PropertyLine({ view, index }: { view: PlayerView; index: number }) {
  const tile = tileAt(index);
  const mortgaged = view.properties[index]?.mortgaged === true;
  return (
    <li className="flex items-center gap-2">
      <span
        className="h-3 w-4 shrink-0 rounded-sm ring-1 ring-tinta/30"
        style={{ backgroundColor: tile.kind === 'property' ? GROUP_COLORS[tile.group] : '#94a3b8' }}
      />
      <span>
        {i18n.tileName(tile, view.rules.useRealBrands)}
        {mortgaged && isOwnable(tile) && (
          <span className="block text-sm text-tinta/70">
            {t('trade.mortgagedNote', { amount: i18n.money(mortgageInterest(tile.mortgage)) })}
          </span>
        )}
      </span>
    </li>
  );
}

function TradeEditor({
  view,
  onAct,
  onClose,
  initial,
}: Props & {
  initial: { counter: boolean; to: string; offer: TradeBundle; request: TradeBundle };
}) {
  const me = view.viewerId ?? '';
  const [to, setTo] = useState(initial.to);
  const [offer, setOffer] = useState<TradeBundle>(initial.offer);
  const [request, setRequest] = useState<TradeBundle>(initial.request);
  const partner = view.players.find((p) => p.id === to);
  const error = tradeContentError(rulesView(view), me, to, offer, request);
  const others = view.players.filter((p) => p.id !== me && !p.bankrupt);

  return (
    <Dialog title={initial.counter ? t('trade.counter') : t('trade.open')} onClose={onClose}>
      {!initial.counter && (
        <fieldset className="mb-4">
          <legend className="mb-1 font-bold">{t('trade.with')}</legend>
          <div className="flex flex-wrap gap-2">
            {others.map((player) => (
              <label
                key={player.id}
                className={`flex cursor-pointer items-center gap-2 rounded-full bg-superficie px-3 py-1.5 ring-2 ${to === player.id ? 'ring-tinta' : 'ring-transparent'}`}
              >
                <input
                  type="radio"
                  name="trade-partner"
                  className="sr-only"
                  checked={to === player.id}
                  onChange={() => {
                    setTo(player.id);
                    setRequest(EMPTY);
                  }}
                />
                <TokenBadge
                  color={tokenColor(player.tokenId)}
                  tokenId={player.tokenId}
                  label={player.name}
                  size="1.2rem"
                />
                {player.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <BundleEditor
          view={view}
          owner={me}
          title={t('trade.youGive')}
          bundle={offer}
          onChange={setOffer}
        />
        {partner !== undefined && (
          <BundleEditor
            view={view}
            owner={partner.id}
            title={t('trade.theyGive', { name: partner.name })}
            bundle={request}
            onChange={setRequest}
          />
        )}
      </div>
      <p
        className="mt-3 min-h-6 font-bold text-fileteado"
        aria-live="polite"
        data-testid="trade-error"
      >
        {reasonText(error)}
      </p>
      <Button
        className="mt-2"
        data-testid="send-trade"
        disabled={error !== null}
        onClick={() => {
          onAct(
            initial.counter
              ? { type: 'counterTrade', offer, request }
              : { type: 'proposeTrade', to, offer, request },
          );
          onClose();
        }}
      >
        {initial.counter ? t('trade.sendCounter') : t('trade.send')}
      </Button>
    </Dialog>
  );
}

function BundleEditor({
  view,
  owner,
  title,
  bundle,
  onChange,
}: {
  view: PlayerView;
  owner: string;
  title: string;
  bundle: TradeBundle;
  onChange: (bundle: TradeBundle) => void;
}) {
  const player = view.players.find((p) => p.id === owner);
  const state = rulesView(view);
  const owned = BOARD.filter((tile) => view.properties[tile.index]?.ownerId === owner);
  const toggle = <T,>(list: readonly T[], item: T) =>
    list.includes(item) ? list.filter((value) => value !== item) : [...list, item];

  return (
    <section className="rounded-xl bg-superficie p-3" data-testid={`bundle-${owner}`}>
      <h3 className="mb-2 font-bold">{title}</h3>
      <label className="mb-3 flex flex-col gap-1 text-sm">
        {t('trade.cash')}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={player?.cash ?? 0}
          step={10}
          value={bundle.cash}
          onChange={(event) => {
            onChange({ ...bundle, cash: Math.max(0, Math.floor(Number(event.target.value) || 0)) });
          }}
          className="rounded-lg border-2 border-tinta/30 px-2 py-1 text-lg tabular-nums"
        />
      </label>
      {owned.length > 0 && (
        <fieldset className="mb-2">
          <legend className="mb-1 text-sm">{t('trade.properties')}</legend>
          <ul className="space-y-1">
            {owned.map((tile) => {
              const blocked = blockedByBuildings(state, tile.index);
              return (
                <li key={tile.index}>
                  <label
                    className={`flex items-start gap-2 ${blocked ? 'opacity-50' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      disabled={blocked}
                      checked={bundle.properties.includes(tile.index)}
                      onChange={() => {
                        onChange({ ...bundle, properties: toggle(bundle.properties, tile.index) });
                      }}
                      className="mt-1"
                    />
                    <span>
                      <PropertyLabel view={view} index={tile.index} />
                      {blocked && <span className="block text-sm">{t('trade.hasBuildings')}</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
      {(player?.jailFreeCards.length ?? 0) > 0 && (
        <fieldset>
          <legend className="mb-1 text-sm">{t('trade.jailCards')}</legend>
          {player?.jailFreeCards.map((card) => (
            <label key={card} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={bundle.jailFreeCards.includes(card)}
                onChange={() => {
                  onChange({ ...bundle, jailFreeCards: toggle(bundle.jailFreeCards, card) });
                }}
              />
              {t(card.startsWith('chance.') ? 'deck.chance' : 'deck.community')}
            </label>
          ))}
        </fieldset>
      )}
    </section>
  );
}

function PropertyLabel({ view, index }: { view: PlayerView; index: number }) {
  const tile = tileAt(index);
  const mortgaged = view.properties[index]?.mortgaged === true;
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-2">
        <span
          className="h-3 w-4 shrink-0 rounded-sm ring-1 ring-tinta/30"
          style={{
            backgroundColor: tile.kind === 'property' ? GROUP_COLORS[tile.group] : '#94a3b8',
          }}
        />
        {i18n.tileName(tile, view.rules.useRealBrands)}
      </span>
      {mortgaged && isOwnable(tile) && (
        <span className="text-sm text-tinta/70">
          {t('trade.mortgagedNote', { amount: i18n.money(mortgageInterest(tile.mortgage)) })}
        </span>
      )}
    </span>
  );
}
