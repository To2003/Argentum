import {
  buildError,
  mortgageError,
  mortgageLiftCost,
  sellError,
  unmortgageError,
  type Action,
  type ErrorCode,
  type PlayerView,
} from '@gran-negocio/engine';
import { BOARD, COLOR_GROUPS, GROUP_TILES, tileAt, type ColorGroup } from '@gran-negocio/shared';
import { GROUP_COLORS } from '../../game/colors.js';
import { reasonText } from '../../game/reasonText.js';
import { rulesView } from '../../game/rulesView.js';
import { i18n, t } from '../../i18n.js';
import { Button, Dialog } from '../ui.js';

/**
 * Las propiedades propias, por grupo (SPEC.md §7.4): construir y vender
 * parejo, hipotecar y levantar hipotecas. Cada botón está habilitado según las
 * acciones legales y, si no se puede, dice por qué (con las reglas del engine).
 */
export function ManageDialog({
  view,
  onAct,
  onClose,
}: {
  view: PlayerView;
  onAct: (action: Action) => void;
  onClose: () => void;
}) {
  const me = view.viewerId ?? '';
  const state = rulesView(view);
  const legal = (action: Action) =>
    view.legal.some((item) => JSON.stringify(item) === JSON.stringify(action));
  const owned = (index: number) => view.properties[index]?.ownerId === me;
  const groups = COLOR_GROUPS.filter((group) => GROUP_TILES[group].some(owned));
  const others = BOARD.filter((tile) => tile.kind !== 'property' && owned(tile.index));

  const row = (index: number) => {
    const tile = tileAt(index);
    const property = view.properties[index];
    const houses = property?.houses ?? 0;
    const actions: { action: Action; label: string; error: ErrorCode | null }[] = [];
    if (tile.kind === 'property') {
      actions.push({
        action: { type: 'buildHouse', tile: index },
        label: t(houses === 4 ? 'action.buildHotel' : 'action.buildHouse', {
          amount: i18n.money(tile.houseCost),
        }),
        error: buildError(state, me, index),
      });
      if (houses > 0) {
        actions.push({
          action: { type: 'sellBuilding', tile: index },
          label: t('action.sellBuilding', { amount: i18n.money(tile.houseCost / 2) }),
          error: sellError(state, me, index),
        });
      }
    }
    if ('mortgage' in tile) {
      actions.push(
        property?.mortgaged === true
          ? {
              action: { type: 'unmortgage', tile: index },
              label: t('action.unmortgage', {
                amount: i18n.money(mortgageLiftCost(tile.mortgage)),
              }),
              error: unmortgageError(state, me, index, mortgageLiftCost),
            }
          : {
              action: { type: 'mortgage', tile: index },
              label: t('action.mortgage', { amount: i18n.money(tile.mortgage) }),
              error: mortgageError(state, me, index),
            },
      );
    }
    return (
      <li key={index} className="rounded-lg bg-superficie p-3" data-testid={`manage-${index}`}>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="font-bold">{i18n.tileName(tile, view.rules.useRealBrands)}</span>
          <span className="text-sm tabular-nums text-tinta/70">
            {property?.mortgaged === true
              ? t('tileInfo.mortgaged')
              : houses === 5
                ? t('tileInfo.hotel')
                : houses > 0
                  ? t('tileInfo.buildings', { count: houses })
                  : ''}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map(({ action, label, error }) => {
            const enabled = legal(action);
            return (
              <span key={action.type} className="flex flex-col">
                <Button
                  variant={action.type === 'buildHouse' ? 'primary' : 'secondary'}
                  disabled={!enabled}
                  data-manage={`${action.type}-${index}`}
                  onClick={() => {
                    onAct(action);
                  }}
                  className="px-3 py-1.5 text-sm"
                >
                  {label}
                </Button>
                {!enabled && error !== null && (
                  <span className="mt-0.5 max-w-48 text-xs text-tinta/60">{reasonText(error)}</span>
                )}
              </span>
            );
          })}
        </div>
      </li>
    );
  };

  const groupBlock = (group: ColorGroup) => {
    const sellAll: Action = { type: 'sellAllBuildings', group };
    const complete = GROUP_TILES[group].every(owned);
    return (
      <section
        key={group}
        className="rounded-xl p-2"
        style={{ backgroundColor: `${GROUP_COLORS[group]}22` }}
      >
        <h3 className="mb-2 flex items-center gap-2 font-bold">
          <span className="h-3 w-5 rounded-sm" style={{ backgroundColor: GROUP_COLORS[group] }} />
          {i18n.groupName(group)}
          {complete && <span className="text-sm font-normal">({t('manage.groupComplete')})</span>}
        </h3>
        <ul className="space-y-2">{GROUP_TILES[group].filter(owned).map(row)}</ul>
        {legal(sellAll) && (
          <Button
            variant="secondary"
            className="mt-2 px-3 py-1.5 text-sm"
            onClick={() => {
              onAct(sellAll);
            }}
          >
            {t('action.sellAllBuildings')}
          </Button>
        )}
      </section>
    );
  };

  return (
    <Dialog title={t('manage.open')} onClose={onClose}>
      <p className="mb-3 text-sm text-tinta/70">
        {t('manage.bank', { houses: view.bank.houses, hotels: view.bank.hotels })}
      </p>
      {groups.length === 0 && others.length === 0 ? (
        <p>{t('manage.empty')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(groupBlock)}
          {others.length > 0 && (
            <section className="rounded-xl bg-tablero p-2">
              <h3 className="mb-2 font-bold">{t('manage.others')}</h3>
              <ul className="space-y-2">{others.map((tile) => row(tile.index))}</ul>
            </section>
          )}
        </div>
      )}
    </Dialog>
  );
}
