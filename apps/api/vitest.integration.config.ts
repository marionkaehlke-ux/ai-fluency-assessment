import { defineConfig } from 'vitest/config';

// Integration tests run against a REAL Postgres test database (spec §12.4: "use a test
// database, not mocks"). BullMQ/SMTP are mocked in the suites — they are external
// side-effects, not the data model under test. Requires a migrated test DB; see
// `npm run test:integration` in the api package and the README.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
    setupFiles: ['./test/integration/setup.ts'],
    fileParallelism: false, // serialise — suites share one database
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://localhost:5432/aifluency_test?schema=public',
      REDIS_URL: 'redis://localhost:6379',
      ANTHROPIC_API_KEY: 'sk-ant-test',
      CLAUDE_MODEL: 'claude-sonnet-4-5',
      ELT_EMAILS: 'elt@phrase.com',
      ADMIN_CALIBRATOR_GROUP: 'phrase-people-ops',
      CURRENT_CYCLE: '2026-H1',
    },
  },
});
