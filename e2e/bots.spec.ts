import { expect, test } from '@playwright/test';

/** M8: el host suma bots en el lobby y juega contra ellos hasta el final. */
test('una persona contra dos bots, de punta a punta', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'una vez alcanza');
  test.setTimeout(180_000);
  await page.goto('/');
  await page.getByLabel('Tu nombre').fill('Ana');
  await page.getByRole('button', { name: 'Crear partida' }).click();
  await page.locator('[data-bot=hard]').click();
  await page.locator('[data-bot=easy]').click();
  await expect(page.getByText('bot difícil')).toBeVisible();
  await expect(page.getByText('bot fácil')).toBeVisible();
  await page.locator('#rule-maxRounds').selectOption({ label: '10' });
  await page.locator('#rule-turnTimerSeconds').selectOption({ label: 'Sin límite' });
  await page.getByTestId('start').click();
  await expect(page.getByTestId('board')).toBeVisible();

  for (let i = 0; i < 3000; i += 1) {
    if ((await page.getByTestId('game-over').count()) > 0) break;
    const pass = page.getByRole('dialog').getByRole('button', { name: 'Paso' });
    if (await pass.isVisible().catch(() => false)) {
      await pass.click({ timeout: 300 }).catch(() => undefined);
      continue;
    }
    const reject = page.getByRole('dialog').getByRole('button', { name: 'Rechazar' });
    if (await reject.isVisible().catch(() => false)) {
      await reject.click({ timeout: 300 }).catch(() => undefined);
      continue;
    }
    const button = page.locator('[data-testid=actions] button').first();
    if (await button.isEnabled({ timeout: 200 }).catch(() => false)) {
      await button.click({ timeout: 300 }).catch(() => undefined);
      const confirm = page.getByRole('button', { name: 'Sí, confirmo' });
      if (await confirm.isVisible().catch(() => false))
        await confirm.click().catch(() => undefined);
    }
  }
  await expect(page.getByTestId('game-over')).toBeVisible();
});
