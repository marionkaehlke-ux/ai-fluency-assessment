import type { FastifyInstance } from 'fastify';
import { ok } from '@ai-fluency/shared';
import { config } from '../config.js';
import { Errors } from '../lib/errors.js';
import { authorise } from '../middleware/auth.js';
import { getTeamOverview } from '../services/team.js';

export async function teamRoutes(app: FastifyInstance): Promise<void> {
  // Team distribution + per-person scores. A manager may only view their own team
  // (ELT / ADMIN_CALIBRATOR may view any).
  app.get('/team/:managerId/overview', { preHandler: authorise('MANAGER') }, async (req) => {
    const { managerId } = req.params as { managerId: string };
    const u = req.currentUser;
    if (managerId !== u.id && u.role !== 'ELT' && u.role !== 'ADMIN_CALIBRATOR') {
      throw Errors.forbidden();
    }
    const cycle = (req.query as { cycle?: string }).cycle ?? config.CURRENT_CYCLE;
    return ok(await getTeamOverview(managerId, cycle));
  });
}
