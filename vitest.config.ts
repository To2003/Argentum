import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.ts', 'apps/*/vitest.config.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/*/src/**'],
      reporter: ['text-summary', 'html'],
      thresholds: {
        // SPEC.md §10: cobertura mínima del engine.
        'packages/engine/src/**': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});
