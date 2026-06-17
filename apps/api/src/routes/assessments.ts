import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ok } from '@ai-fluency/shared';
import { config } from '../config.js';
import { Errors } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { assertOwnerOrManager, authorise } from '../middleware/auth.js';
import {
  calibrateSchema,
  createAssessmentSchema,
  saveDraftSchema,
  submitSchema,
} from '../schemas/requests.js';
import {
  calibrate,
  createOrGetDraft,
  flagForSABuilds,
  getAssessment,
  listUserAssessments,
  saveDraft,
  submit,
  triggerScoring,
} from '../services/assessment.js';

const aiRateLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

/** Calibration is restricted to the owner's direct manager or an ADMIN_CALIBRATOR (spec §4.4). */
async function assertCanCalibrate(req: FastifyRequest, ownerId: string): Promise<void> {
  const u = req.currentUser;
  if (u.role === 'ADMIN_CALIBRATOR') return;
  if (ownerId === u.id) throw Errors.forbidden('You cannot calibrate your own assessment.');
  const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { managerId: true } });
  if (owner?.managerId === u.id) return;
  throw Errors.forbidden('Only the employee’s manager can calibrate this assessment.');
}

export async function assessmentRoutes(app: FastifyInstance): Promise<void> {
  // Create (or fetch existing) DRAFT for the caller in a cycle.
  app.post('/assessments', { preHandler: authorise('EMPLOYEE') }, async (req) => {
    const body = createAssessmentSchema.partial().parse(req.body ?? {});
    const cycle = body.cycle ?? config.CURRENT_CYCLE;
    return ok(await createOrGetDraft(req.currentUser, cycle));
  });

  app.get('/assessments/:id', async (req) => {
    const { id } = req.params as { id: string };
    const assessment = await getAssessment(id);
    await assertOwnerOrManager(req, assessment);
    return ok(assessment);
  });

  // Draft autosave (owner only).
  app.patch('/assessments/:id', async (req) => {
    const { id } = req.params as { id: string };
    const assessment = await getAssessment(id);
    if (assessment.userId !== req.currentUser.id) throw Errors.forbidden();
    const body = saveDraftSchema.parse(req.body);
    return ok(await saveDraft(id, req.currentUser, body));
  });

  // Submit self-assessment for scoring (owner only).
  app.post('/assessments/:id/submit', async (req) => {
    const { id } = req.params as { id: string };
    const assessment = await getAssessment(id);
    if (assessment.userId !== req.currentUser.id) throw Errors.forbidden();
    const body = submitSchema.parse(req.body);
    return ok(await submit(id, req.currentUser, body));
  });

  // (Re)trigger Claude scoring — owner or manager. AI endpoint → 10 req/min.
  app.post('/assessments/:id/score', aiRateLimit, async (req) => {
    const { id } = req.params as { id: string };
    const assessment = await getAssessment(id);
    await assertOwnerOrManager(req, assessment);
    await triggerScoring(id);
    return ok({ queued: true });
  });

  // Manager confirms agreed levels.
  app.post(
    '/assessments/:id/calibrate',
    { preHandler: authorise('MANAGER') },
    async (req) => {
      const { id } = req.params as { id: string };
      const assessment = await getAssessment(id);
      await assertCanCalibrate(req, assessment.userId);
      const body = calibrateSchema.parse(req.body);
      return ok(await calibrate(id, req.currentUser, body));
    },
  );

  // Flag an L3/L4 performer for the SA Builds programme.
  app.post(
    '/assessments/:id/flag',
    { preHandler: authorise('MANAGER') },
    async (req) => {
      const { id } = req.params as { id: string };
      const assessment = await getAssessment(id);
      await assertCanCalibrate(req, assessment.userId);
      return ok(await flagForSABuilds(id, req.currentUser));
    },
  );

  // All assessments for a user, by cycle.
  app.get('/users/:id/assessments', async (req) => {
    const { id } = req.params as { id: string };
    const u = req.currentUser;
    if (id !== u.id && u.role !== 'ELT' && u.role !== 'ADMIN_CALIBRATOR') {
      const target = await prisma.user.findUnique({ where: { id }, select: { managerId: true } });
      if (target?.managerId !== u.id) throw Errors.forbidden();
    }
    return ok(await listUserAssessments(id));
  });

  // TEMPORARY: lets the current user delete their own assessment for the current cycle.
  app.delete('/assessments/me/current', async (req) => {
    const u = req.currentUser;
    await prisma.assessment.deleteMany({
      where: { userId: u.id, cycle: config.CURRENT_CYCLE },
    });
    return ok({ deleted: true });
  });
}
