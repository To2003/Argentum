import { mortgageLiftCost, type Action, type PlayerView } from '@gran-negocio/engine';
import { tileAt, tokenColor } from '@gran-negocio/shared';
import { TileIcon } from '../../art/icons.js';
import { groupSwatch } from '../../game/colors.js';
import { i18n, t } from '../../i18n.js';
import { Button, Dialog, TokenBadge } from '../ui.js';

/**
 * Detalle de una casilla (SPEC.md §7.4.4): alquileres, dueño, edificios,
 * hipoteca y, si es tuya, lo que podés hacer con ella ahora.
 */
export function TileDialog({
  index,
  view,
  onAct,
  onClose,
}: {
  index: number;
  view: PlayerView;
  onAct: (action: Action) => void;
  onClose: () => void;
}) {
  const tile = tileAt(index);
  const name = i18n.tileName(tile, view.rules.useRealBrands);
  const detail = i18n.tileDetail(tile);
  const owned = view.properties[index];
  const owner = owned === undefined ? undefined : view.players.find((p) => p.id === owned.ownerId);

  const forThisTile = view.legal.filter(
    (action) =>
      ('tile' in action && action.tile === index) ||
      (action.type === 'sellAllBuildings' &&
        tile.kind === 'property' &&
        action.group === tile.group),
  );

  const label = (action: Action): string => {
    switch (action.type) {
      case 'buildHouse':
        return tile.kind === 'property'
          ? t((owned?.houses ?? 0) === 4 ? 'action.buildHotel' : 'action.buildHouse', {
              amount: i18n.money(tile.houseCost),
            })
          : action.type;
      case 'sellBuilding':
        return t('action.sellBuilding', {
          amount: i18n.money(tile.kind === 'property' ? tile.houseCost / 2 : 0),
        });
      case 'sellAllBuildings':
        return t('action.sellAllBuildings');
      case 'mortgage':
        return t('action.mortgage', { amount: i18n.money('mortgage' in tile ? tile.mortgage : 0) });
      case 'unmortgage':
        return t('action.unmortgage', {
          amount: i18n.money('mortgage' in tile ? mortgageLiftCost(tile.mortgage) : 0),
        });
      default:
        return action.type;
    }
  };

  return (
    <Dialog title={name} onClose={onClose}>
      {tile.kind === 'property' && (
        <div className="-mx-5 -mt-4 mb-4 h-3" style={groupSwatch(tile.group)} />
      )}
      <div className="mb-3 flex items-center gap-3">
        <TileIcon tile={tile} className="h-12 w-12 shrink-0" />
        {detail !== undefined && <p className="text-tinta/70">{detail}</p>}
      </div>

      {'price' in tile && (
        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums">
          <dt>{t('tileInfo.price')}</dt>
          <dd className="text-right font-bold">{i18n.money(tile.price)}</dd>
          <dt>{t('tileInfo.mortgageValue')}</dt>
          <dd className="text-right">{i18n.money(tile.mortgage)}</dd>
          {tile.kind === 'property' && (
            <>
              <dt>{t('tileInfo.houseCost')}</dt>
              <dd className="text-right">{i18n.money(tile.houseCost)}</dd>
            </>
          )}
        </dl>
      )}

      {tile.kind === 'property' && (
        <section className="mb-4">
          <h3 className="mb-1 font-bold">{t('tileInfo.rent')}</h3>
          <table className="w-full tabular-nums">
            <tbody>
              {tile.rent.map((rent, houses) => (
                <tr
                  key={houses}
                  className={(owned?.houses ?? -1) === houses ? 'bg-sol/30 font-bold' : ''}
                >
                  <td className="py-0.5">
                    {houses === 0
                      ? t('tileInfo.rentBase')
                      : houses === 5
                        ? t('tileInfo.rentHotel')
                        : t('tileInfo.rentHouses', { count: houses })}
                  </td>
                  <td className="text-right">{i18n.money(rent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-sm text-tinta/70">{t('tileInfo.rentMonopoly')}</p>
        </section>
      )}
      {tile.kind === 'subway' && (
        <table className="mb-4 w-full tabular-nums">
          <tbody>
            {tile.rent.map((rent, i) => (
              <tr key={i}>
                <td>{t('tileInfo.subwayRent', { count: i + 1 })}</td>
                <td className="text-right">{i18n.money(rent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tile.kind === 'utility' && (
        <ul className="mb-4">
          {tile.multipliers.map((multiplier, i) => (
            <li key={i}>{t('tileInfo.utilityRent', { count: i + 1, multiplier })}</li>
          ))}
        </ul>
      )}
      {tile.kind === 'tax' && (
        <p className="mb-4">{t('tileInfo.tax', { amount: i18n.money(tile.amount) })}</p>
      )}

      {'price' in tile && (
        <p className="mb-4 flex items-center gap-2">
          <span className="font-bold">{t('tileInfo.owner')}:</span>
          {owner === undefined ? (
            t('tileInfo.noOwner')
          ) : (
            <>
              <TokenBadge
                color={tokenColor(owner.tokenId)}
                tokenId={owner.tokenId}
                label={owner.name}
              />
              {owner.name}
            </>
          )}
        </p>
      )}
      {owned?.mortgaged === true && (
        <p className="mb-4 font-bold text-fileteado">{t('tileInfo.mortgaged')}</p>
      )}

      {forThisTile.length > 0 && (
        <div className="flex flex-col gap-2">
          {forThisTile.map((action) => (
            <Button
              key={JSON.stringify(action)}
              variant={
                action.type === 'buildHouse' || action.type === 'unmortgage'
                  ? 'primary'
                  : 'secondary'
              }
              onClick={() => {
                onAct(action);
              }}
            >
              {label(action)}
            </Button>
          ))}
        </div>
      )}
    </Dialog>
  );
}
