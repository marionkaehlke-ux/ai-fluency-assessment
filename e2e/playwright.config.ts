import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const DB_URL =
  process.env.E2E_DATABASE_URL ??
  `postgresql://${process.env.USER}@localhost:5432/aifluency_e2e?schema=public`;
const APP_PORT = 3100;
const MOCK_PORT = 8787;

// Exported so globalSetup can migrate + seed the same database.
export const E2E_DB_URL = DB_URL;

export default defineConfig({
  testDir: './tests',
  globalSetup: './support/global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: `node support/mock-anthropic.mjs`,
      port: MOCK_PORT,
      reuseExistingServer: !process.env.CI,
      env: { MOCK_ANTHROPIC_PORT: String(MOCK_PORT) },
    },
    {
      command: `npx tsx apps/api/src/server.ts`,
      cwd: repoRoot,
      url: `http://localhost:${APP_PORT}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(APP_PORT),
        STATIC_DIR: resolve(repoRoot, 'apps/web/dist'),
        DATABASE_URL: DB_URL,
        REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
        ANTHROPIC_API_KEY: 'sk-ant-e2e',
        ANTHROPIC_BASE_URL: `http://localhost:${MOCK_PORT}`,
        CLAUDE_MODEL: 'claude-sonnet-4-5',
        SCORING_PROMPT_VERSION: 'v1',
        SCORING_ENABLED: 'true',
        AUTH_DEV_BYPASS: 'false',
        ELT_EMAILS: 'elt.e2e@phrase.com',
        ADMIN_CALIBRATOR_GROUP: 'phrase-people-ops',
        CURRENT_CYCLE: '2026-H1',
      },
    },
  ],
});
