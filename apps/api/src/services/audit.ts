import type { Prisma } from '@prisma/client';
import type { AuditAction } from '@ai-fluency/shared';
import { prisma } from '../lib/prisma.js';

/**
 * Append an immutable audit entry (CLAUDE.md: audit_log is append-only).
 * Accepts a transaction client so mutations and their audit row commit atomically.
 */
export async function audit(
  params: {
    userId: string | null;
    action: AuditAction;
    targetId?: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
  },
  client: Pick<typeof prisma, 'auditLog'> = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      targetId: params.targetId,
      before: params.before,
      after: params.after,
      metadata: params.metadata,
    },
  });
}
