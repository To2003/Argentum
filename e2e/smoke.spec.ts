import { expect, test } from '@playwright/test';

test('la landing carga en es-AR', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'El Gran Negocio' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-AR');
});

test('el server de juego responde', async ({ request }) => {
  const response = await request.get('http://localhost:3001/health');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ ok: true, tiles: 40 });
});
