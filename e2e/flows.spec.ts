import { devices, expect, test, type Browser, type Page } from '@playwright/test';

/**
 * M7: subasta, trueque y construcción jugados por la UI, sin consola. Cada
 * test arranca de un escenario de desarrollo del server (una partida ya
 * armada) con Ana en escritorio y Beto en celular.
 */
interface Scenario {
  code: string;
  seats: { playerId: string; name: string; token: string }[];
}

async function open(browser: Browser, name: 'auction' | 'trade' | 'build') {
  const response = await fetch(`http://localhost:3001/dev/scenario/${name}`, { method: 'POST' });
  const scenario = (await response.json()) as Scenario;
  const pages: Page[] = [];
  for (const [i, seat] of scenario.seats.entries()) {
    const context = await browser.newContext(
      i === 0 ? { viewport: { width: 1280, height: 800 } } : { ...devices['Pixel 7'] },
    );
    const session = { code: scenario.code, playerId: seat.playerId, token: seat.token };
    await context.addInitScript((value) => {
      localStorage.setItem(`gran-negocio:session:${value.code}`, JSON.stringify(value));
    }, session);
    const page = await context.newPage();
    await page.goto(`/sala/${scenario.code}`);
    await expect(page.getByTestId('board')).toBeVisible();
    pages.push(page);
  }
  const [ana, beto] = pages as [Page, Page];
  return { ana, beto };
}

/** Cada test ya usa escritorio y celular: corre una sola vez. */
const onlyOnce = (projectName: string) => {
  test.skip(projectName !== 'desktop', 'cada test ya usa escritorio y celular');
};

test('subasta: rechazar, pujar, superar y ganar', async ({ browser }, info) => {
  onlyOnce(info.project.name);
  const { ana, beto } = await open(browser, 'auction');
  await ana.getByRole('button', { name: 'No la compro' }).click();

  // La subasta se abre sola para los dos.
  const anaAuction = ana.getByRole('dialog');
  const betoAuction = beto.getByRole('dialog');
  await expect(anaAuction).toContainText('Subasta: Puerto Madero');
  await expect(betoAuction).toContainText('Todavía nadie pujó');

  await anaAuction.getByTestId('bid-amount').fill('120');
  await anaAuction.getByTestId('bid').click();
  await expect(betoAuction.getByTestId('auction-high')).toContainText('Va ganando Ana');

  // Beto usa el atajo +$50 sobre la mínima y puja.
  await betoAuction.getByRole('button', { name: /^\+\$\s?50$/ }).click();
  await expect(betoAuction.getByTestId('bid-amount')).toHaveValue('171');
  await betoAuction.getByTestId('bid').click();
  await expect(anaAuction.getByTestId('auction-high')).toContainText('Va ganando Beto');

  await anaAuction.getByRole('button', { name: 'Paso' }).click();
  await expect(ana.locator('[data-tile="39"]')).toHaveAttribute('aria-label', /Dueño: Beto/);
  await expect(ana.getByTestId('event-log')).toContainText('Beto se quedó con Puerto Madero');
});

test('trueque: proponer, contraofertar y aceptar, con validación en vivo', async ({
  browser,
}, info) => {
  onlyOnce(info.project.name);
  const { ana, beto } = await open(browser, 'trade');
  await ana.getByTestId('open-trade').click();
  const editor = ana.getByRole('dialog');

  // Vacío no se puede: el editor lo dice.
  await expect(editor.getByTestId('trade-error')).toContainText('tiene que incluir algo');
  await expect(editor.getByTestId('send-trade')).toBeDisabled();

  // Ana da Caminito y pide San Telmo (hipotecada: avisa el interés).
  await editor
    .getByTestId('bundle-p1')
    .getByLabel(/Caminito/)
    .check();
  await editor
    .getByTestId('bundle-p2')
    .getByLabel(/Feria de San Telmo/)
    .check();
  await expect(editor).toContainText('quien la recibe paga');
  // Más plata de la que tiene: inválido.
  await editor.getByTestId('bundle-p1').getByLabel('Plata').fill('99999');
  await expect(editor.getByTestId('trade-error')).toContainText('No alcanza la plata');
  await editor.getByTestId('bundle-p1').getByLabel('Plata').fill('0');
  await editor.getByTestId('send-trade').click();

  // A Beto se le abre solo; contraoferta: además pide $100.
  const incoming = beto.getByRole('dialog');
  await expect(incoming.getByTestId('trade-title')).toContainText('Ana te propone un trueque');
  await incoming.getByRole('button', { name: 'Contraofertar' }).click();
  await incoming.getByTestId('bundle-p1').getByLabel('Plata').fill('100');
  await incoming.getByTestId('send-trade').click();

  const counter = ana.getByRole('dialog');
  await expect(counter.getByTestId('trade-title')).toContainText('Beto te propone un trueque');
  await counter.getByTestId('accept-trade').click();

  await expect(ana.locator('[data-tile="3"]')).toHaveAttribute('aria-label', /Dueño: Ana/);
  await expect(ana.locator('[data-tile="1"]')).toHaveAttribute('aria-label', /Dueño: Beto/);
  // 1500 − 100 de la contraoferta − 3 de interés por la hipotecada.
  await expect(ana.getByTestId('cash-p1')).toHaveText(/1\.397/);
});

test('construcción: pareja, con el motivo cuando no se puede, y venta', async ({
  browser,
}, info) => {
  onlyOnce(info.project.name);
  const { ana } = await open(browser, 'build');
  await ana.getByTestId('open-manage').click();
  const manage = ana.getByRole('dialog');

  await manage.locator('[data-manage="buildHouse-1"]').click();
  await expect(manage.getByTestId('manage-1')).toContainText('1 casa');
  // Construcción pareja: otra en Caminito no, y dice por qué.
  await expect(manage.locator('[data-manage="buildHouse-1"]')).toBeDisabled();
  await expect(manage.getByTestId('manage-1')).toContainText('construir y vender parejo');
  // Con casas en el grupo no se hipoteca.
  await expect(manage.getByTestId('manage-3')).toContainText('vender los edificios del grupo');

  await manage.locator('[data-manage="buildHouse-3"]').click();
  await manage.locator('[data-manage="buildHouse-1"]').click();
  await expect(manage.getByTestId('manage-1')).toContainText('2 casas');
  await manage.locator('[data-manage="sellBuilding-1"]').click();
  await expect(manage.getByTestId('manage-1')).toContainText('1 casa');
  await expect(manage).toContainText('En el banco quedan 30 casas');
  await ana.getByRole('button', { name: 'Cerrar' }).click();
  await expect(ana.locator('[data-tile="1"]')).toBeVisible();
});
