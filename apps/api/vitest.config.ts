import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
    globalSetup: ['src/test/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // The integration suites (global-setup migrations + supertest apps) blow
    // past Node's default old-space long before finishing, killing worker
    // forks with "Fatal process out of memory: Zone" and reporting every test
    // in the file as failed. 4 GiB covers the heaviest suite with headroom;
    // raise this if a future global fixture grows further.
    maxWorkers: 4,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
    env: {
      REDIS_URL: '',
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      include: ['src/modules/**/*.ts', 'src/shared/**/*.ts'],
    },
  },
});
