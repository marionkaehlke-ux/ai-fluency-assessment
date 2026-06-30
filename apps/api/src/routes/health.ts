import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

/** Liveness (/healthz) and readiness (/readyz) endpoints (CLAUDE.md / 12-factor). */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/readyz', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch (err) {
      reply.code(503);
      return { status: 'not-ready', detail: (err as Error).message };
    }
  });
}
