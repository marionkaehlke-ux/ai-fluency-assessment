import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

/** Liveness (/healthz) and readiness (/readyz) endpoints (CLAUDE.md / 12-factor). */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // Liveness: process is up. No external dependency checks.
  app.get('/healthz', async () => ({ status: 'ok' }));

  // Readiness: can serve traffic — DB and Redis reachable.
  app.get('/readyz', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redis.ping();
      return { status: 'ready' };
    } catch (err) {
      reply.code(503);
      return { status: 'not-ready', detail: (err as Error).message };
    }
  });
}
