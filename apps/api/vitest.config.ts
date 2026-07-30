import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Loading db/pool triggers ../config/env, which loads dotenv from the
    // repo-root .env the same way the running app does — no extra setup file
    // is needed for env vars to be available in tests.
    globals: false,
    testTimeout: 20000,
    hookTimeout: 20000,
    include: ['src/**/*.test.ts']
  }
});
