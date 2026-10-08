import type { RulesConfig, RulesOverrides } from '@gran-negocio/shared';
import { i18n, t } from '../../i18n.js';

type Option<T> = readonly [T, string];

const seconds = (n: number) => (n === 0 ? t('rules.unlimited') : t('rules.seconds', { count: n }));

/** Las reglas que el host puede tocar, con sus opciones (SPEC.md §5.9). */
function options(): {
  key: keyof RulesConfig;
  values: readonly Option<RulesConfig[keyof RulesConfig]>[];
  warning?: string;
}[] {
  const yesNo: readonly Option<boolean>[] = [
    [true, t('rules.on')],
    [false, t('rules.off')],
  ];
  return [
    {
      key: 'startingCash',
      values: [1000, 1500, 2000, 2500].map((n) => [n, i18n.money(n)] as const),
    },
    { key: 'salary', values: [100, 200, 300].map((n) => [n, i18n.money(n)] as const) },
    { key: 'turnTimerSeconds', values: [0, 30, 60, 90, 120].map((n) => [n, seconds(n)] as const) },
    { key: 'auctionOnDecline', values: yesNo },
    { key: 'evenBuild', values: yesNo },
    { key: 'doubleRentOnMonopoly', values: yesNo },
    { key: 'freeParkingPot', values: yesNo, warning: t('rules.freeParkingPot.warning') },
    {
      key: 'maxRounds',
      values: [null, 10, 20, 30, 50].map(
        (n) => [n, n === null ? t('rules.unlimited') : String(n)] as const,
      ),
    },
    {
      key: 'gameDurationMinutes',
      values: [null, 30, 60, 90].map(
        (n) => [n, n === null ? t('rules.unlimited') : t('rules.minutes', { count: n })] as const,
      ),
    },
    { key: 'maxPlayers', values: [2, 3, 4, 5, 6].map((n) => [n, String(n)] as const) },
    { key: 'useRealBrands', values: yesNo },
  ];
}

/** El host las cambia; los demás ven el resumen de reglas activas. */
export function RulesForm({
  rules,
  editable,
  onChange,
}: {
  rules: RulesConfig;
  editable: boolean;
  onChange: (overrides: RulesOverrides) => void;
}) {
  return (
    <dl className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2">
      {options().map(({ key, values, warning }) => {
        const current = values.findIndex(([value]) => value === rules[key]);
        const label = t(`rules.${key}` as 'rules.salary');
        return (
          <div key={key} className="contents">
            <dt>
              <label htmlFor={`rule-${key}`}>{label}</label>
              {warning !== undefined && rules[key] === true && (
                <p className="text-sm text-fileteado">{warning}</p>
              )}
            </dt>
            <dd>
              {editable ? (
                <select
                  id={`rule-${key}`}
                  value={current}
                  onChange={(event) => {
                    const chosen = values[Number(event.target.value)];
                    if (chosen !== undefined) onChange({ [key]: chosen[0] });
                  }}
                  className="rounded-lg border-2 border-tinta/30 bg-superficie px-2 py-1"
                >
                  {values.map(([, text], index) => (
                    <option key={text} value={index}>
                      {text}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-bold">{values[current]?.[1] ?? String(rules[key])}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
