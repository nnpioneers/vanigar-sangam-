import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import globals from 'globals';

/**
 * Root lint configuration for the monorepo.
 *
 * `apps/web` is intentionally excluded: the Next.js application owns its own
 * ESLint configuration (run via `npm run lint --workspace @vanigar/web`).
 */
export default defineConfig([
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', 'apps/web/**', '**/*.tsbuildinfo'],
  },
  {
    files: ['**/*.{ts,mts,cts}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
]);
