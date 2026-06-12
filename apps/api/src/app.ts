import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import { fail, type ProblemDetails } from '@ai-fluency/shared';
import { config } from './config.js';
import { AppError } from './lib/errors.js';
import { authenticate } from './middleware/auth.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { assessmentRoutes } from './routes/assessments.js';
import { teamRoutes } from './routes/team.js';
import { orgRoutes } from './routes/org.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    // Trust the gateway in front of us for client IP / proto (rate-limit keying).
    trustProxy: true,
    genReqId: () => crypto.randomUUID(),
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(sensible);
  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: 100, // 100 req/min per user (spec §7.1)
    timeWindow: '1 minute',
    keyGenerator: (req) => req.currentUser?.id ?? req.ip,
  });

  // Uniform RFC 7807 error envelope (spec §7.1).
  app.setErrorHandler((err, req, reply) => {
    let problem: ProblemDetails;

    if (err instanceof AppError) {
      problem = err.toProblem(req.url);
    } else if (err instanceof ZodError) {
      problem = {
        type: 'about:blank',
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Request validation failed.',
        instance: req.url,
        errors: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      };
    } else if (typeof (err as { statusCode?: number }).statusCode === 'number') {
      const e = err as Error & { statusCode: number };
      problem = { type: 'about:blank', title: e.name, status: e.statusCode, detail: e.message, instance: req.url };
    } else {
      req.log.error({ err }, 'Unhandled error');
      problem = {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred.',
        instance: req.url,
      };
    }

    reply.code(problem.status).type('application/problem+json').send(fail(problem));
  });

  // Public health endpoints (no auth) — used by Kubernetes probes.
  await app.register(healthRoutes);

  // Authenticated API surface.
  await app.register(
    async (api) => {
      api.addHook('preHandler', authenticate);
      await api.register(authRoutes);
      await api.register(assessmentRoutes);
      await api.register(teamRoutes);
      await api.register(orgRoutes);
    },
    { prefix: '/api/v1' },
  );

  // In production, serve the built React SPA from STATIC_DIR (CLAUDE.md). The SPA
  // fallback returns index.html for client-side routes but never shadows /api or probes.
  if (config.STATIC_DIR && existsSync(config.STATIC_DIR)) {
    await app.register(fastifyStatic, { root: config.STATIC_DIR });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api') && !req.url.startsWith('/health') && !req.url.startsWith('/readyz')) {
        return reply.sendFile('index.html');
      }
      return reply.code(404).type('application/problem+json').send({
        data: null,
        error: { type: 'about:blank', title: 'Not Found', status: 404, instance: req.url },
      });
    });
  }

  return app;
}
