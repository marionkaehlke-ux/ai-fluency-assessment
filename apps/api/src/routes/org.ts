import type { FastifyInstance } from 'fastify';
import { AUDIT_ACTIONS, ok } from '@ai-fluency/shared';
import { authorise } from '../middleware/auth.js';
import { audit } from '../services/audit.js';
import { buildExportCsv, getOrgDashboard } from '../services/org.js';
import { generateOrgNarrative } from '../services/narrative.js';

const eltOnly = { preHandler: authorise('ELT') };
const aiRateLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

export async function orgRoutes(app: FastifyInstance): Promise<void> {
  // Org-wide aggregated dashboard data.
  app.get('/org/dashboard', eltOnly, async (req) => {
    const cycle = (req.query as { cycle?: string }).cycle;
    return ok(await getOrgDashboard(cycle));
  });

  // Anonymised CSV of all calibrated scores.
  app.get('/org/export', eltOnly, async (req, reply) => {
    const cycle = (req.query as { cycle?: string }).cycle;
    const csv = await buildExportCsv(cycle);
    await audit({
      userId: req.currentUser.id,
      action: AUDIT_ACTIONS.EXPORT_GENERATED,
      metadata: { cycle: cycle ?? 'all' },
    });
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="ai-fluency-${cycle ?? 'all'}.csv"`);
    return csv;
  });

  // On-demand executive narrative via Claude. AI endpoint → 10 req/min.
  app.post('/org/narrative', { ...eltOnly, ...aiRateLimit }, async (req) => {
    const cycle = (req.query as { cycle?: string }).cycle;
    const narrative = await generateOrgNarrative(cycle);
    await audit({
      userId: req.currentUser.id,
      action: AUDIT_ACTIONS.NARRATIVE_GENERATED,
      metadata: { cycle: cycle ?? 'all' },
    });
    return ok({ narrative });
  });
}
