import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { seed } from './seed.mjs';
import { E2E_DB_URL } from '../playwright.config';

const here = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(here, '../../apps/api');

/** Create (if needed), migrate, and seed the E2E database before any test runs. */
export default async function globalSetup(): Promise<void> {
  const dbName = new URL(E2E_DB_URL).pathname.slice(1).split('?')[0];

  // Create the database if it doesn't exist (ignore "already exists").
  try {
    execSync(`createdb ${dbName}`, { stdio: 'ignore' });
  } catch {
    /* already exists */
  }

  execSync('npx prisma migrate deploy', {
    cwd: apiDir,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: E2E_DB_URL },
  });

  await seed(E2E_DB_URL);
}
