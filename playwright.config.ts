import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env['CI']);

/**
 * E2E contra el server y la web reales. Playwright los levanta solo (y los
 * reutiliza si ya están corriendo en local con `pnpm dev`).
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @gran-negocio/server start:e2e',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !CI,
    },
    {
      command: 'pnpm --filter @gran-negocio/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !CI,
    },
  ],
});
