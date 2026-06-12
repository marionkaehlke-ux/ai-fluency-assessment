import { beforeEach, describe, expect, it, vi } from 'vitest';

// External side-effects are mocked; the database is real.
vi.mock('../../src/queue/scoring-queue.js', () => ({ enqueueScoring: vi.fn() }));
vi.mock('../../src/services/notify.js', () => ({ sendManagerSubmissionEmail: vi.fn(async () => undefined) }));

import { DIMENSIONS } from '@ai-fluency/shared';
import { prisma } from '../../src/lib/prisma.js';
import { enqueueScoring } from '../../src/queue/scoring-queue.js';
import {
  calibrate,
  createOrGetDraft,
  getAssessment,
  saveDraft,
  submit,
} from '../../src/services/assessment.js';
import type { CurrentUser } from '../../src/types.js';

const enqueueMock = enqueueScoring as unknown as ReturnType<typeof vi.fn>;

async function seedUser(
  email: string,
  opts: { role?: CurrentUser['role']; managerId?: string; name?: string } = {},
): Promise<CurrentUser> {
  const u = await prisma.user.create({
    data: { email, name: opts.name ?? email, role: opts.role ?? 'EMPLOYEE', managerId: opts.managerId },
  });
  return { id: u.id, email: u.email, name: u.name, role: u.role, functionArea: u.functionArea, managerId: u.managerId, groups: [] };
}

const longText = (s: string) => s.padEnd(90, ' ').concat('x'.repeat(20));

function submitBody(expectedUpdatedAt: Date) {
  return {
    expectedUpdatedAt,
    openingResponse: longText('my honest opening reflection about where I am with AI today'),
    responses: DIMENSIONS.map((dimension) => ({ dimension, employeeResponse: longText(`response for ${dimension}`) })),
  };
}

function calibrateBody(expectedUpdatedAt: Date, levels: number[]) {
  return {
    expectedUpdatedAt,
    manager_confirmed: true as const,
    dimensions: DIMENSIONS.map((dimension, i) => ({ dimension, agreedLevel: levels[i]!, managerNotes: `note ${dimension}` })),
  };
}

beforeEach(() => enqueueMock.mockClear());

describe('assessment lifecycle (real DB)', () => {
  it('creates a DRAFT with four dimension rows and is idempotent per (user, cycle)', async () => {
    const emp = await seedUser('emp@phrase.com');
    const a = await createOrGetDraft(emp, '2026-H1');
    expect(a.status).toBe('DRAFT');
    expect(a.dimensionScores).toHaveLength(4);

    const again = await createOrGetDraft(emp, '2026-H1');
    expect(again.id).toBe(a.id); // no duplicate
    expect(await prisma.assessment.count()).toBe(1);

    const audits = await prisma.auditLog.findMany({ where: { action: 'ASSESSMENT_CREATED' } });
    expect(audits).toHaveLength(1);
  });

  it('saves draft responses and rejects a stale optimistic-lock token with 409', async () => {
    const emp = await seedUser('emp@phrase.com');
    const a = await createOrGetDraft(emp, '2026-H1');

    const saved = await saveDraft(a.id, emp, {
      expectedUpdatedAt: a.updatedAt,
      openingResponse: 'draft so far',
      responses: [{ dimension: 'MINDSET', employeeResponse: 'mindset draft' }],
    });
    expect(saved.openingResponse).toBe('draft so far');

    await expect(
      saveDraft(a.id, emp, { expectedUpdatedAt: new Date(0), openingResponse: 'stale write' }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('submits DRAFT → SELF_SUBMITTED, enqueues scoring once, and is idempotent', async () => {
    const emp = await seedUser('emp@phrase.com');
    const a = await createOrGetDraft(emp, '2026-H1');

    const submitted = await submit(a.id, emp, submitBody(a.updatedAt));
    expect(submitted.status).toBe('SELF_SUBMITTED');
    expect(enqueueMock).toHaveBeenCalledTimes(1);

    // Second submit is a no-op — no re-scoring.
    const fresh = await getAssessment(a.id);
    await submit(a.id, emp, submitBody(fresh.updatedAt));
    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });

  it('calibrates SELF_SUBMITTED → CALIBRATED and computes composite from AGREED levels only', async () => {
    const emp = await seedUser('emp@phrase.com');
    const mgr = await seedUser('mgr@phrase.com', { role: 'MANAGER' });
    await prisma.user.update({ where: { id: emp.id }, data: { managerId: mgr.id } });

    const a = await createOrGetDraft(emp, '2026-H1');
    await submit(a.id, emp, submitBody(a.updatedAt));

    // Simulate the AI having suggested HIGH levels — these must NOT influence the composite.
    await prisma.dimensionScore.updateMany({ where: { assessmentId: a.id }, data: { aiSuggestedLevel: 4 } });

    const before = await getAssessment(a.id);
    const agreed = [1, 2, 2, 3]; // composite = 2.0
    const result = await calibrate(a.id, mgr, calibrateBody(before.updatedAt, agreed));

    expect(result.status).toBe('CALIBRATED');
    expect(result.compositeLevel).toBe(2); // from agreed [1,2,2,3], NOT from aiSuggested=4
    expect(result.calibration?.conductedAt).toBeTruthy();

    const stored = await prisma.dimensionScore.findMany({ where: { assessmentId: a.id }, orderBy: { dimension: 'asc' } });
    expect(stored.every((d) => d.agreedLevel != null)).toBe(true);

    const agreedAudit = await prisma.auditLog.findMany({ where: { action: 'SCORE_AGREED' } });
    expect(agreedAudit).toHaveLength(1);
  });

  it('rejects calibration with a stale optimistic-lock token', async () => {
    const emp = await seedUser('emp@phrase.com');
    const mgr = await seedUser('mgr@phrase.com', { role: 'MANAGER' });
    const a = await createOrGetDraft(emp, '2026-H1');
    await submit(a.id, emp, submitBody(a.updatedAt));

    await expect(calibrate(a.id, mgr, calibrateBody(new Date(0), [1, 1, 1, 1]))).rejects.toMatchObject({
      status: 409,
    });
  });
});
