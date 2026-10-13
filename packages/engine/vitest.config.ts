import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'engine',
    include: ['test/**/*.test.ts'],
    // Una falla del fuzz tiene que leerse entera: sin "{ …(3) }" en los objetos
    // de las aserciones (el contraejemplo y la secuencia van además en
    // test-results/fuzz-failure-*.json).
    chaiConfig: { truncateThreshold: 0 },
  },
});
