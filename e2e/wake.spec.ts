import { expect, test, type Page } from '@playwright/test';

/**
 * Server dormido (Render gratis): mientras "duerme", Playwright corta las
 * conexiones WebSocket al server y los pedidos a /health. La web tiene que
 * avisar que lo está despertando y, cuando "despierta", seguir sola con la
 * acción pendiente.
 */
const SERVER = /localhost:3001/;

async function sleepServer(page: Page) {
  const state = { asleep: true };
  await page.routeWebSocket(SERVER, (ws) => {
    if (state.asleep) {
      void ws.close();
      return;
    }
    ws.connectToServer();
  });
  await page.route(/localhost:3001\/health/, (route) =>
    state.asleep ? route.abort('connectionrefused') : route.continue(),
  );
  return state;
}

test('crear una sala con el server dormido: avisa, espera y entra cuando despierta', async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  const server = await sleepServer(page);
  await page.goto('/');
  await page.getByLabel('Tu nombre').fill('Ana');
  await page.getByRole('button', { name: 'Crear partida' }).click();

  const notice = page.getByTestId('wake-notice');
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await expect(notice).toContainText('Despertando el server…');
  await expect(notice).toContainText('Puede tardar hasta un minuto');
  await expect(page.getByRole('progressbar', { name: 'Espera del server' })).toBeVisible();
  await expect(notice).toContainText(/Van [1-9]\d* s/);
  await page.screenshot({ path: info.outputPath('despertando.png') });

  // "Despierta": la web lo nota por /health y retoma la creación sola.
  server.asleep = false;
  await expect(page.getByTestId('room-code')).toBeVisible({ timeout: 30_000 });
  await expect(notice).toBeHidden();
  await expect(page).toHaveURL(/\/sala\/[A-Z2-9]{6}$/);
  // Un solo asiento: el intento de cuando dormía no se duplicó.
  await expect(page.getByText('1 jugador', { exact: false })).toBeVisible();
  await page.screenshot({ path: info.outputPath('despierto.png') });
});

test('volver a una sala con el server dormido conserva la sesión y retoma', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'una vez alcanza');
  test.setTimeout(90_000);
  await page.goto('/');
  await page.getByLabel('Tu nombre').fill('Beto');
  await page.getByRole('button', { name: 'Crear partida' }).click();
  const code = (await page.getByTestId('room-code').textContent()) ?? '';

  // El server "se duerme" y se recarga la sala: vuelve con el token guardado.
  const server = await sleepServer(page);
  await page.reload();
  await expect(page.getByTestId('wake-notice')).toBeVisible({ timeout: 15_000 });
  server.asleep = false;
  await expect(page.getByTestId('room-code')).toHaveText(code, { timeout: 30_000 });
  await expect(page.getByText('Beto')).toBeVisible();
});
