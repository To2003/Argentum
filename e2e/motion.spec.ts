import { expect, test, type Browser } from '@playwright/test';

/**
 * M6: la ficha salta casilla por casilla, salvo con prefers-reduced-motion,
 * donde llega directo (SPEC.md §7.2).
 */
async function rollAsAna(browser: Browser, reducedMotion: 'reduce' | 'no-preference') {
  const response = await fetch('http://localhost:3001/dev/scenario/build', { method: 'POST' });
  const scenario = (await response.json()) as {
    code: string;
    seats: { playerId: string; token: string }[];
  };
  const seat = scenario.seats[0];
  if (seat === undefined) throw new Error('sin asiento');
  const context = await browser.newContext({ reducedMotion });
  await context.addInitScript(
    (value) => {
      localStorage.setItem(`gran-negocio:session:${value.code}`, JSON.stringify(value));
    },
    { code: scenario.code, playerId: seat.playerId, token: seat.token },
  );
  const page = await context.newPage();
  await page.goto(`/sala/${scenario.code}`);
  const token = page.locator('[data-token="p1"]');
  await expect(token).toHaveAttribute('data-position', '0');
  await page.locator('[data-action=rollDice]').click();
  await page.waitForTimeout(250);
  const early = await token.getAttribute('data-position');
  await page.waitForTimeout(4000);
  const final = await token.getAttribute('data-position');
  await context.close();
  return { early, final };
}

test('con movimiento reducido la ficha llega directo; sin, salta de a una casilla', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'arma sus propios contextos');
  const reduced = await rollAsAna(browser, 'reduce');
  expect(reduced.final).not.toBe('0');
  expect(reduced.early).toBe(reduced.final);

  const animated = await rollAsAna(browser, 'no-preference');
  expect(animated.final).not.toBe('0');
  // A los 250 ms todavía están rodando los dados: la ficha no llegó.
  expect(animated.early).not.toBe(animated.final);
});
