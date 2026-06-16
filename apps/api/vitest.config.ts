import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Integration tests hit live Postgres/Redis; run files sequentially to avoid
    // cross-test interference on shared infrastructure.
    fileParallelism: false,
    hookTimeout: 20_000,
    testTimeout: 20_000,
  },
});
