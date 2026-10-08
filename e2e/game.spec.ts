import { devices, expect, test, type Page } from '@playwright/test';

/**
 * M5: una partida entera entre dos navegadores (escritorio y celular), por la
 * UI real: crear, unirse por link, marcar listo, configurar, empezar y jugar
 * apretando siempre la primera acción disponible hasta el final.
 */
test('dos navegadores juegan una partida completa de punta a punta', async ({ browser }, info) => {
  // Arma sus propios contextos (escritorio + celular): corre una sola vez.
  test.skip(info.project.name !== 'desktop', 'el test ya usa los dos dispositivos');
  test.setTimeout(180_000);

  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const mob = await browser.newContext({ ...devices['Pixel 7'] });
  const ana = await desk.newPage();
  const beto = await mob.newPage();
  const errors: string[] = [];
  for (const page of [ana, beto]) page.on('pageerror', (error) => errors.push(error.message));

  await ana.goto('/');
  await ana.getByLabel('Tu nombre').fill('Ana');
  await ana.getByRole('button', { name: 'Crear partida' }).click();
  const code = (await ana.getByTestId('room-code').textContent())?.trim() ?? '';
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  await beto.goto(`/sala/${code}`);
  await beto.getByLabel('Tu nombre').fill('Beto');
  await beto.getByRole('button', { name: 'Entrar' }).click();
  await beto.getByTestId('ready').click();

  await ana.locator('#rule-maxRounds').selectOption({ label: '10' });
  await ana.locator('#rule-turnTimerSeconds').selectOption({ label: 'Sin límite' });
  await expect(beto.getByText('Límite de rondas')).toBeVisible();
  await ana.getByTestId('start').click();
  await expect(ana.getByTestId('board')).toBeVisible();
  await expect(beto.getByTestId('board')).toBeVisible();

  const step = async (page: Page) => {
    // El estado cambia todo el tiempo (juega el otro): timeouts cortos y a la
    // próxima vuelta si el botón ya no está.
    const button = page.locator('[data-testid=actions] button').first();
    if (!(await button.isEnabled({ timeout: 300 }).catch(() => false))) return;
    await button.click({ timeout: 300 }).catch(() => undefined);
    const confirm = page.getByRole('button', { name: 'Sí, confirmo' });
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click({ timeout: 300 }).catch(() => undefined);
    }
  };

  for (let i = 0; i < 2000; i += 1) {
    if ((await ana.getByTestId('game-over').count()) > 0) break;
    await step(ana);
    await step(beto);
  }
  await expect(ana.getByTestId('game-over')).toBeVisible();
  await expect(beto.getByTestId('game-over')).toBeVisible();
  await expect(ana.getByTestId('event-log')).toContainText('Ganó');

  // Recargar no saca a nadie: vuelve con la sesión guardada.
  await beto.reload();
  await expect(beto.getByTestId('game-over')).toBeVisible();

  expect(errors).toEqual([]);
  await desk.close();
  await mob.close();
});
