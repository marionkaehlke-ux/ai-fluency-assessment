import { afterAll, beforeAll, beforeEach } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';

// Connect once; truncate between tests so each starts from a clean database.
beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "audit_log","manager_calibrations","dimension_scores","assessments","users" RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
