import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';

/**
 * Pinch-zoom y pan del tablero en celular (SPEC.md §4.1, §7.7). Los toques son
 * de verdad (CDP `Input.dispatchTouchEvent`), con dos dedos para el pinch.
 */

interface Touch {
  readonly x: number;
  readonly y: number;
  readonly id: number;
}

type TouchType = 'touchStart' | 'touchMove' | 'touchEnd';

async function touch(cdp: CDPSession, type: TouchType, points: Touch[]) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map(({ x, y, id }) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })),
  });
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('sin caja');
  return box;
}

/** Dos dedos que se separan (o se juntan) desde el centro de la ventana del tablero. */
async function pinch(viewport: Locator, cdp: CDPSession, from: number, to: number) {
  const box = await boxOf(viewport);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const at = (gap: number): Touch[] => [
    { x: cx - gap, y: cy, id: 1 },
    { x: cx + gap, y: cy, id: 2 },
  ];
  await touch(cdp, 'touchStart', at(from));
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    await touch(cdp, 'touchMove', at(from + ((to - from) * i) / steps));
  }
  await touch(cdp, 'touchEnd', []);
}

/** Arrastre horizontal de un dedo desde `from`, `dx` píxeles. */
async function drag(cdp: CDPSession, from: { x: number; y: number }, dx: number) {
  const start = { ...from, id: 1 };
  await touch(cdp, 'touchStart', [start]);
  const steps = 10;
  for (let i = 1; i <= steps; i += 1) {
    await touch(cdp, 'touchMove', [{ ...start, x: start.x + (dx * i) / steps }]);
  }
  await touch(cdp, 'touchEnd', []);
}

/** Un punto a la vista donde, al tocar, se toca una casilla (no el centro ni otra cosa encima). */
async function visibleTile(page: Page, viewport: Locator) {
  const view = await boxOf(viewport);
  for (const tile of await page.locator('[data-tile]').all()) {
    const box = await tile.boundingBox();
    if (box === null) continue;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const inside = x > view.x && y > view.y && x < view.x + view.width && y < view.y + view.height;
    if (!inside) continue;
    const index = await tile.getAttribute('data-tile');
    const hit = await page.evaluate(
      ([px, py]) =>
        document.elementFromPoint(px, py)?.closest('[data-tile]')?.getAttribute('data-tile'),
      [x, y] as const,
    );
    if (hit === index) return { x, y };
  }
  throw new Error('ninguna casilla a la vista');
}

async function startGame(page: Page) {
  await page.goto('/');
  await page.getByLabel('Tu nombre').fill('Ana');
  await page.getByRole('button', { name: 'Crear partida' }).click();
  await page.locator('[data-bot=easy]').click();
  await page.locator('#rule-turnTimerSeconds').selectOption({ label: 'Sin límite' });
  await page.getByTestId('start').click();
  await expect(page.getByTestId('board')).toBeVisible();
}

const scaleOf = async (viewport: Locator) => Number(await viewport.getAttribute('data-scale'));
const scrollOf = (viewport: Locator) =>
  viewport.evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop }));

test('pinch para acercar (aparecen los nombres), pan con un dedo y volver', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'el pinch es de celular');
  await startGame(page);
  const cdp = await page.context().newCDPSession(page);
  const viewport = page.getByTestId('board-viewport');
  const name39 = page.locator('[data-tile="39"] .tile-text').first();

  // Entero: los nombres no entran y están ocultos.
  await expect(viewport).toHaveAttribute('data-scale', '1');
  await expect(name39).toBeHidden();
  await page.screenshot({ path: info.outputPath('1-entero.png') });

  // Pinch hacia afuera: el tablero se agranda y los nombres aparecen.
  await pinch(viewport, cdp, 30, 110);
  await expect.poll(() => scaleOf(viewport)).toBeGreaterThan(1.8);
  const zoomed = await scrollOf(viewport);
  // El centro quedó quieto: el scroll se fue hacia el medio, no quedó arriba a la izquierda.
  expect(zoomed.x).toBeGreaterThan(50);
  expect(zoomed.y).toBeGreaterThan(50);
  await expect(page.locator('.tile-text:visible').first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('2-pinch-acercado.png') });

  // Pan con un dedo sobre la fila de casillas de arriba: mueve el tablero y NO abre
  // la casilla que queda bajo el dedo al soltar (regresión: el navegador generaba ese click).
  await viewport.evaluate((el) => {
    el.scrollTo(0, 0);
  });
  const view = await boxOf(viewport);
  const row = { x: view.x + view.width * 0.8, y: view.y + 50 };
  const before = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('[data-tile]')?.getAttribute('data-tile'),
    [row.x, row.y] as const,
  );
  expect(before).toBeTruthy();
  await drag(cdp, row, -150);
  await expect.poll(async () => (await scrollOf(viewport)).x).toBeGreaterThan(100);
  await page.waitForTimeout(300);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('3-pan.png') });

  // Con zoom, tocar una casilla abre su detalle (también después de un pan).
  const tile = await visibleTile(page, viewport);
  await page.touchscreen.tap(tile.x, tile.y);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Pinch hacia adentro: vuelve al tablero entero, sin scroll.
  await pinch(viewport, cdp, 140, 20);
  await expect(viewport).toHaveAttribute('data-scale', '1');
  expect(await scrollOf(viewport)).toEqual({ x: 0, y: 0 });
  await expect(name39).toBeHidden();
});

test('"Acercar a mi ficha" sigue andando y muestra los nombres', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'el botón es de celular');
  await startGame(page);
  const viewport = page.getByTestId('board-viewport');
  await page.getByRole('button', { name: 'Acercar a mi ficha' }).click();
  await expect(viewport).toHaveAttribute('data-scale', '2.2');
  // La ficha propia (en la Salida al empezar) queda a la vista, con los nombres de al lado.
  await expect(page.locator('[data-tile="0"]')).toBeInViewport();
  await expect(page.locator('[data-tile="1"] .tile-text').first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('acercar-a-mi-ficha.png') });
  await page.getByRole('button', { name: 'Ver todo el tablero' }).click();
  await expect(viewport).toHaveAttribute('data-scale', '1');
});
