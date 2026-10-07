import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'server',
    include: ['test/**/*.test.ts'],
    // Sockets reales: un poco más lentos que un unit test puro.
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
