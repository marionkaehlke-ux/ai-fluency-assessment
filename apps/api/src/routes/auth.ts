import type { FastifyInstance } from 'fastify';
import { ok } from '@ai-fluency/shared';
import { config } from '../config.js';

/**
 * Current user profile + role (spec §7.2 GET /auth/me).
 * Login/callback are NOT implemented here — Okta handles auth at the ingress gateway
 * (CLAUDE.md). The frontend reads identity from this endpoint on each app load.
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get('/auth/me', async (req) => {
    const u = req.currentUser;
    return ok({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      functionArea: u.functionArea,
      managerId: u.managerId,
      currentCycle: config.CURRENT_CYCLE,
    });
  });
}
