import { expect, test } from '@playwright/test';

// El hot-seat solo existe en dev; Playwright levanta la web con `vite` (dev).
test('el hot-seat de debug juega el engine en el navegador', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.getByLabel('seed').fill('0123456789abcdef0123456789abcdef');
  await page.getByRole('button', { name: 'Nueva partida' }).click();
  await expect(page.getByText(/fase waitingRoll/)).toBeVisible();
  await page.getByRole('button', { name: 'rollDice' }).click();
  await expect(page.getByTestId('events')).toContainText('"type":"diceRolled"');
  await page.getByRole('button', { name: 'Auto ×200' }).click();
  await expect(page.getByText(/Rechazada/)).toHaveCount(0);
});

test('sin ?debug=1 se ve la landing', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'El Gran Negocio' })).toBeVisible();
});
