import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import { AUDIT_ACTIONS, type Dimension } from '@ai-fluency/shared';
import { prisma } from '../lib/prisma.js';
import { redis, createRedis } from '../lib/redis.js';
import { audit } from '../services/audit.js';
import { scoreAssessment, ScoringFailedError, type ScoringInput } from '../services/scoring.js';

const QUEUE_NAME = 'scoring';
const LOCK_TTL_MS = 60_000; // distributed scoring lock (spec §7a.4)

interface ScoringJobData {
  assessmentId: string;
}

// ioredis instance is a valid runtime connection; the cast bridges duplicate ioredis types.
const connection = redis as unknown as ConnectionOptions;

export const scoringQueue = redis
  ? new Queue<ScoringJobData, void, 'score'>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3, // retry up to 3 times before dead-letter (spec §7a.1)
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 1000,
        removeOnFail: false, // keep failed jobs as the dead-letter record
      },
    })
  : null;

/** Acquire a short-lived Redis lock so parallel scoring jobs can't run for one assessment. */
async function acquireLock(key: string): Promise<boolean> {
  const res = await redis!.set(`lock:scoring:${key}`, '1', 'PX', LOCK_TTL_MS, 'NX');
  return res === 'OK';
}
async function releaseLock(key: string): Promise<void> {
  await redis!.del(`lock:scoring:${key}`);
}

export async function enqueueScoring(assessmentId: string): Promise<void> {
  if (!scoringQueue) return; // SCORING_ENABLED=false — no queue, no-op
  // Idempotent by assessment id — a duplicate enqueue replaces the pending job.
  await scoringQueue.add('score', { assessmentId }, { jobId: assessmentId });
}

const DIMENSION_FIELD: Record<Dimension, keyof ScoringInput> = {
  MINDSET: 'mindset',
  STRATEGY: 'strategy',
  BUILDING: 'building',
  ACCOUNTABILITY: 'accountability',
};

async function processJob(job: Job<ScoringJobData, void, 'score'>): Promise<void> {
  const { assessmentId } = job.data;

  if (!(await acquireLock(assessmentId))) {
    // Another worker holds the lock; let BullMQ retry shortly.
    throw new Error('scoring lock held by another worker');
  }

  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { dimensionScores: true },
    });
    if (!assessment) return; // nothing to do
    if (!assessment.openingResponse) throw new Error('assessment missing opening response');

    const byDim = new Map(assessment.dimensionScores.map((d) => [d.dimension, d]));
    const input = { openingResponse: assessment.openingResponse } as ScoringInput;
    for (const [dim, field] of Object.entries(DIMENSION_FIELD) as [Dimension, keyof ScoringInput][]) {
      const text = byDim.get(dim)?.employeeResponse;
      if (!text) throw new Error(`assessment missing ${dim} response`);
      input[field] = text;
    }

    const { result, model, promptVersion } = await scoreAssessment(input);

    // Persist AI suggestions only. agreedLevel/compositeLevel are untouched here —
    // they require manager confirmation (spec §7a.3).
    await prisma.$transaction(async (tx) => {
      for (const dim of Object.keys(DIMENSION_FIELD) as Dimension[]) {
        const r = result[DIMENSION_FIELD[dim] as keyof typeof result];
        await tx.dimensionScore.update({
          where: { assessmentId_dimension: { assessmentId, dimension: dim } },
          data: { aiSuggestedLevel: r.level, aiRationale: r.rationale },
        });
      }
      await tx.assessment.update({ where: { id: assessmentId }, data: { scoringFailed: false } });
      await audit(
        {
          userId: assessment.userId,
          action: AUDIT_ACTIONS.SCORE_GENERATED,
          targetId: assessmentId,
          metadata: { model, promptVersion },
        },
        tx,
      );
    });
  } finally {
    await releaseLock(assessmentId);
  }
}

/** Start the BullMQ worker. Called from server bootstrap. */
export function startScoringWorker(): Worker<ScoringJobData, void, 'score'> {
  const worker = new Worker<ScoringJobData, void, 'score'>(QUEUE_NAME, processJob, {
    connection: createRedis() as unknown as ConnectionOptions,
    concurrency: 10, // rate-limit at 10 concurrent scoring requests (spec §9.3)
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
    // On invalid output (or final failure) flag the assessment and log raw to audit
    // (never to a user-visible field — spec §7a.2).
    if (err instanceof ScoringFailedError || isFinalAttempt) {
      await prisma.assessment
        .update({ where: { id: job.data.assessmentId }, data: { scoringFailed: true } })
        .catch(() => undefined);
      await audit({
        userId: null,
        action: AUDIT_ACTIONS.SCORE_FAILED,
        targetId: job.data.assessmentId,
        metadata: {
          cause: err instanceof ScoringFailedError ? err.failureCause : 'worker_error',
          attemptsMade: job.attemptsMade,
          deadLettered: isFinalAttempt,
          raw: err instanceof ScoringFailedError ? err.raw?.slice(0, 4000) : undefined,
        },
      }).catch(() => undefined);
    }
  });

  return worker;
}
