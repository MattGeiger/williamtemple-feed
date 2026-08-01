/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Every test file shares one dev.db (DATABASE_URL="file:../dev.db"), so
    // running files in parallel lets one file's seed or truncate invalidate
    // another's assertions. The failures moved between runs, which is why they
    // read as unrelated flakiness rather than a shared-fixture problem.
    //
    // Serialising makes the suite deterministic. The real fix is a database per
    // worker (ISSUES.md #59); until then, a slower honest suite beats a fast
    // one whose green runs are partly luck.
    fileParallelism: false,
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '__tests_archive__/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', '__tests_archive__/**/*'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
