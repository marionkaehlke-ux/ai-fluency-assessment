import {
  AUDIT_ACTIONS,
  DIMENSIONS,
  computeComposite,
  compositeToLevel,
  type AssessmentStatus,
  type Dimension,
} from '@ai-fluency/shared';
import { prisma } from '../lib/prisma.js';
import { Errors } from '../lib/errors.js';
import { audit } from './audit.js';
import { enqueueScoring } from '../queue/scoring-queue.js';
import { sendManagerSubmissionEmail } from './notify.js';
import type { CurrentUser } from '../types.js';
import type { CalibrateBody, SaveDraftBody, SubmitBody } from '../schemas/requests.js';

const fullInclude = { dimensionScores: true, calibration: true } as const;

export type FullAssessment = Awaited<ReturnType<typeof getAssessment>>;

export async function getAssessment(id: string) {
  const assessment = await prisma.assessment.findUnique({ where: { id }, include: fullInclude });
  if (!assessment) throw Errors.notFound('Assessment not found.');
  return assessment;
}

export async function listUserAssessments(userId: string) {
  return prisma.assessment.findMany({
    where: { userId },
    include: fullInclude,
    orderBy: { cycle: 'desc' },
  });
}

/** POST /assessments — create a DRAFT for (user, cycle), or return the existing one. */
export async function createOrGetDraft(user: CurrentUser, cycle: string) {
  const existing = await prisma.assessment.findUnique({
    where: { userId_cycle: { userId: user.id, cycle } },
    include: fullInclude,
  });
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const created = await tx.assessment.create({
      data: {
        userId: user.id,
        cycle,
        status: 'DRAFT',
        dimensionScores: { create: DIMENSIONS.map((dimension) => ({ dimension })) },
      },
      include: fullInclude,
    });
    await audit(
      { userId: user.id, action: AUDIT_ACTIONS.ASSESSMENT_CREATED, targetId: created.id },
      tx,
    );
    return created;
  });
}

/** Guarded assessment update: enforces optimistic lock and a status precondition. */
async function guardAssessment(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  id: string,
  expectedUpdatedAt: Date,
  allowedStatuses: readonly AssessmentStatus[],
  data: Record<string, unknown>,
): Promise<void> {
  const guard = await tx.assessment.updateMany({
    where: { id, updatedAt: expectedUpdatedAt, status: { in: [...allowedStatuses] } },
    data,
  });
  if (guard.count === 0) {
    // Distinguish a stale token (conflict) from a wrong-status request.
    const current = await tx.assessment.findUnique({ where: { id }, select: { status: true } });
    if (!current) throw Errors.notFound('Assessment not found.');
    if (!allowedStatuses.includes(current.status)) {
      throw Errors.validation(`Assessment cannot be modified in status ${current.status}.`);
    }
    throw Errors.conflict();
  }
}

/** PATCH draft — autosave partial responses while in DRAFT. */
export async function saveDraft(id: string, user: CurrentUser, body: SaveDraftBody) {
  await prisma.$transaction(async (tx) => {
    await guardAssessment(tx, id, body.expectedUpdatedAt, ['DRAFT'], {
      ...(body.openingResponse !== undefined ? { openingResponse: body.openingResponse } : {}),
    });
    for (const r of body.responses ?? []) {
      await tx.dimensionScore.update({
        where: { assessmentId_dimension: { assessmentId: id, dimension: r.dimension } },
        data: { employeeResponse: r.employeeResponse },
      });
    }
  });
  return getAssessment(id);
}

/** POST /submit — lock responses, move to SELF_SUBMITTED, enqueue scoring, notify manager. */
export async function submit(id: string, user: CurrentUser, body: SubmitBody) {
  const before = await getAssessment(id);
  // Idempotent: a second submit on an already-submitted assessment is a no-op (spec §7a.4).
  if (before.status === 'SELF_SUBMITTED' || before.status === 'CALIBRATED') {
    return before;
  }

  await prisma.$transaction(async (tx) => {
    await guardAssessment(tx, id, body.expectedUpdatedAt, ['DRAFT'], {
      status: 'SELF_SUBMITTED',
      openingResponse: body.openingResponse,
    });
    for (const r of body.responses) {
      await tx.dimensionScore.update({
        where: { assessmentId_dimension: { assessmentId: id, dimension: r.dimension } },
        data: { employeeResponse: r.employeeResponse },
      });
    }
    await audit({ userId: user.id, action: AUDIT_ACTIONS.SELF_SUBMITTED, targetId: id }, tx);
  });

  await enqueueScoring(id);

  // Notify the manager (no email when managerId is null — CPeO digest handles those).
  const owner = await prisma.user.findUnique({
    where: { id: before.userId },
    include: { manager: true },
  });
  if (owner?.manager) {
    await sendManagerSubmissionEmail({
      managerEmail: owner.manager.email,
      employeeName: owner.name,
      assessmentId: id,
    }).catch(() => undefined);
  }

  return getAssessment(id);
}

/** POST /score — (re)trigger scoring. Allowed for the owner, the manager, or a server call. */
export async function triggerScoring(id: string) {
  const a = await getAssessment(id);
  if (a.status === 'DRAFT') throw Errors.validation('Assessment has not been submitted yet.');
  await enqueueScoring(id);
}

/**
 * POST /calibrate — the human gate. Requires manager_confirmed: true (enforced by the
 * Zod schema). Writes agreedLevel, computes compositeLevel from agreed values only,
 * and moves to CALIBRATED.
 */
export async function calibrate(id: string, manager: CurrentUser, body: CalibrateBody) {
  const before = await getAssessment(id);
  if (before.status === 'CALIBRATED') return before; // idempotent

  const agreedByDim = new Map<Dimension, number>(
    body.dimensions.map((d) => [d.dimension, d.agreedLevel]),
  );
  const orderedAgreed = DIMENSIONS.map((d) => agreedByDim.get(d)!);
  const composite = computeComposite(orderedAgreed);

  await prisma.$transaction(async (tx) => {
    await guardAssessment(tx, id, body.expectedUpdatedAt, ['SELF_SUBMITTED'], {
      status: 'CALIBRATED',
      compositeLevel: composite,
    });
    for (const d of body.dimensions) {
      await tx.dimensionScore.update({
        where: { assessmentId_dimension: { assessmentId: id, dimension: d.dimension } },
        data: {
          agreedLevel: d.agreedLevel,
          ...(d.managerNotes !== undefined ? { managerNotes: d.managerNotes } : {}),
        },
      });
    }
    await tx.managerCalibration.upsert({
      where: { assessmentId: id },
      create: {
        assessmentId: id,
        managerId: manager.id,
        conductedAt: body.conductedAt ?? new Date(),
        flaggedForSABuilds: body.flaggedForSABuilds ?? false,
      },
      update: {
        managerId: manager.id,
        ...(body.conductedAt ? { conductedAt: body.conductedAt } : {}),
        ...(body.flaggedForSABuilds !== undefined
          ? { flaggedForSABuilds: body.flaggedForSABuilds }
          : {}),
      },
    });
    await audit(
      {
        userId: manager.id,
        action: AUDIT_ACTIONS.SCORE_AGREED,
        targetId: id,
        after: { compositeLevel: composite, overallLevel: compositeToLevel(composite) },
      },
      tx,
    );
  });

  return getAssessment(id);
}

/** POST /flag — nominate an L3/L4 performer for the SA Builds programme (spec §4.2). */
export async function flagForSABuilds(id: string, manager: CurrentUser) {
  const a = await getAssessment(id);
  if (!a.calibration) {
    throw Errors.validation('Assessment must be calibrated before it can be flagged.');
  }
  await prisma.$transaction(async (tx) => {
    await tx.managerCalibration.update({
      where: { assessmentId: id },
      data: { flaggedForSABuilds: true },
    });
    await audit({ userId: manager.id, action: AUDIT_ACTIONS.FLAG_CREATED, targetId: id }, tx);
  });
  return getAssessment(id);
}
