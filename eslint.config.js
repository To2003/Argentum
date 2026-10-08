// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * El engine (y los datos compartidos) tienen que ser puros: sin reloj, sin
 * azar ambiente, sin I/O. Es una restricción de arquitectura (SPEC.md §3.1),
 * así que la hace cumplir el linter y no la revisión.
 */
const forbiddenInPureCode = {
  'no-restricted-globals': [
    'error',
    { name: 'Date', message: 'El engine es determinista: nada de reloj.' },
    { name: 'performance', message: 'El engine es determinista: nada de reloj.' },
    { name: 'crypto', message: 'El azar sale del PRNG con semilla de rng.ts.' },
    { name: 'process', message: 'El engine no toca el entorno.' },
    { name: 'fetch', message: 'El engine no hace I/O.' },
    { name: 'console', message: 'El engine no hace I/O: devolvé eventos.' },
    { name: 'setTimeout', message: 'Los timers viven en el server, no en el engine.' },
    { name: 'setInterval', message: 'Los timers viven en el server, no en el engine.' },
  ],
  'no-restricted-properties': [
    'error',
    { object: 'Math', property: 'random', message: 'El azar sale del PRNG con semilla de rng.ts.' },
    { object: 'Date', property: 'now', message: 'El engine es determinista: nada de reloj.' },
  ],
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['node:*', 'fs', 'fs/*', 'path', 'crypto', 'os', 'child_process'],
          message: 'El engine no hace I/O.',
        },
      ],
    },
  ],
};

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '.tsbuild/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.turbo/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Los configs sueltos no están en el grafo de ningún tsconfig.
          allowDefaultProject: [
            '*.config.js',
            '*.config.ts',
            'packages/*/vitest.config.ts',
            'apps/*/vitest.config.ts',
            'apps/*/tsup.config.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // `_algo`: parámetro que la firma necesita y el cuerpo todavía no (puntos de extensión).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Los tests arman fixtures mutando estados conocidos: el `!` es la aserción del test.
    files: ['**/test/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    files: ['packages/engine/src/**/*.ts', 'packages/shared/src/**/*.ts'],
    rules: forbiddenInPureCode,
  },
  {
    files: ['apps/server/**/*.ts', 'e2e/**/*.ts', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest']],
    languageOptions: { globals: globals.browser },
  },
  {
    // Sin información de tipos para los configs: se lintean solo sintácticamente.
    files: ['*.config.{js,ts}', '**/*.config.{js,ts}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
