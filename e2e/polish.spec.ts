import { expect, test, type Page } from '@playwright/test';

/** Juega lo que le toque a la persona (los bots juegan solos) hasta que termina. */
async function playToTheEnd(page: Page) {
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
}

/**
 * M9: chat con reacciones, un espectador (en inglés), estadísticas al final y
 * revancha en la misma sala.
 */
test('chat, espectador, estadísticas y revancha', async ({ page, browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'una vez alcanza');
  test.setTimeout(240_000);
  await page.goto('/');
  await page.getByLabel('Tu nombre').fill('Ana');
  await page.getByRole('button', { name: 'Crear partida' }).click();
  const code = (await page.getByTestId('room-code').textContent()) ?? '';
  await page.locator('[data-bot=medium]').click();
  await page.locator('#rule-maxRounds').selectOption({ label: '10' });
  await page.locator('#rule-turnTimerSeconds').selectOption({ label: 'Sin límite' });

  // Chat en el lobby: texto y reacción.
  await page.getByLabel('Escribí algo…').fill('¿Arrancamos?');
  await page.getByRole('button', { name: 'Mandar' }).click();
  await page.locator('[data-emote=dale]').click();
  const messages = page.getByTestId('chat-messages');
  await expect(messages).toContainText('Ana: ¿Arrancamos?');
  await expect(messages).toContainText('Ana: ¡Dale, che!');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('board')).toBeVisible();

  // Un espectador, con la app en inglés.
  const other = await browser.newContext();
  const watcher = await other.newPage();
  await watcher.goto('/');
  await watcher.getByRole('button', { name: 'English' }).click();
  await expect(watcher.getByRole('button', { name: 'Create game' })).toBeVisible();
  await watcher.goto(`/sala/${code}`);
  await watcher.getByTestId('watch').click();
  await expect(watcher.getByText('You are watching as a spectator.')).toBeVisible();
  await expect(watcher.getByTestId('board')).toBeVisible();
  await expect(watcher.getByTestId('chat-messages')).toContainText('Ana: Come on!');
  await expect(watcher.getByLabel('Say something…')).toHaveCount(0);
  await expect(watcher.locator('[data-testid=actions]')).toHaveCount(0);

  await page.locator('[data-emote=paga]').click();
  await expect(watcher.getByTestId('chat-messages')).toContainText('Ana: Pay up!');

  await playToTheEnd(page);
  await expect(page.getByTestId('game-over')).toBeVisible();
  await expect(page.getByTestId('stats')).toBeVisible();
  await expect(page.getByRole('img', { name: /Patrimonio por ronda/ })).toBeVisible();
  await expect(watcher.getByTestId('stats')).toBeVisible();
  await expect(watcher.getByTestId('rematch')).toHaveCount(0);

  // Revancha: la sala vuelve al lobby con el mismo código y el bot listo.
  await page.getByTestId('rematch').click();
  await expect(page.getByTestId('room-code')).toHaveText(code);
  await expect(page.getByText('bot medio')).toBeVisible();
  await expect(page.getByTestId('start')).toBeEnabled();
  // El espectador no tiene asiento en el lobby: vuelve a la pantalla para entrar.
  await expect(watcher.getByTestId('watch')).toBeVisible();
  await other.close();
});
