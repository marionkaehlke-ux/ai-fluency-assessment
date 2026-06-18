import type { FastifyReply, FastifyRequest } from 'fastify';
import { ROLE_PRECEDENCE, type UserRole } from '@ai-fluency/shared';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { Errors } from '../lib/errors.js';
import { getPersonioEmployee } from '../services/personio.js';
import type { CurrentUser } from '../types.js';

/** Claims the ingress gateway places in the base64-encoded X-Userinfo header (spec §8.1). */
interface UserInfo {
  sub: string;
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  groups?: string[];
}

export function decodeUserInfo(header: string): UserInfo {
  const json = Buffer.from(header, 'base64').toString('utf8');
  const parsed = JSON.parse(json) as UserInfo;
  if (!parsed.email) throw new Error('X-Userinfo missing email claim');
  return parsed;
}

/**
 * Resolve the app role from identity + org data.
 * Precedence (spec §3.2): ADMIN_CALIBRATOR > ELT > MANAGER > EMPLOYEE.
 * Personio is the source of truth for the manager flag; in the MVP the manager
 * relationship is seeded via CSV import (live Personio sync is Phase 2).
 */
export function resolveRole(email: string, groups: string[], isManager: boolean): UserRole {
  if (groups.includes(config.ADMIN_CALIBRATOR_GROUP)) return 'ADMIN_CALIBRATOR';
  if (config.eltEmails.has(email.toLowerCase())) return 'ELT';
  if (isManager) return 'MANAGER';
  return 'EMPLOYEE';
}

/**
 * Authentication hook. Reads identity from the gateway header (prod) or the dev
 * bypass (local only), syncs the User row, resolves the role, and attaches
 * request.currentUser. We never implement login here — Okta owns that at the gateway.
 */
export async function authenticate(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  let info: UserInfo;

  const header = req.headers['x-userinfo'];
  if (typeof header === 'string' && header.length > 0) {
    try {
      info = decodeUserInfo(header);
    } catch {
      throw Errors.unauthorized('Invalid X-Userinfo header.');
    }
  } else if (config.AUTH_DEV_BYPASS && config.AUTH_DEV_EMAIL) {
    info = {
      sub: 'dev',
      email: config.AUTH_DEV_EMAIL,
      name: config.AUTH_DEV_NAME ?? config.AUTH_DEV_EMAIL,
      groups: (config.AUTH_DEV_GROUPS ?? '').split(',').map((g) => g.trim()).filter(Boolean),
    };
  } else {
    throw Errors.unauthorized();
  }

  const email = info.email.toLowerCase();
  const groups = info.groups ?? [];
  const name =
    info.name ?? (`${info.given_name ?? ''} ${info.family_name ?? ''}`.trim() || email);

  // Sync org data from Personio (source of truth per CLAUDE.md). Falls back to
  // existing DB values when Personio is unreachable or credentials are not set.
  const personio = await getPersonioEmployee(email);

  let managerId: string | null = null;
  if (personio?.managerEmail) {
    const manager = await prisma.user.findUnique({
      where: { email: personio.managerEmail.toLowerCase() },
      select: { id: true },
    });
    managerId = manager?.id ?? null;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  const orgUpdate = personio
    ? {
        functionArea: personio.functionArea,
        ...(managerId !== null ? { managerId } : {}),
      }
    : {};

  const reportsCount = existing
    ? await prisma.user.count({ where: { managerId: existing.id } })
    : 0;
  const role = resolveRole(email, groups, reportsCount > 0);

  const user = existing
    ? await prisma.user.update({ where: { email }, data: { name, role, ...orgUpdate } })
    : await prisma.user.create({
        data: { email, name, role, functionArea: personio?.functionArea ?? 'UNASSIGNED', managerId },
      });

  const current: CurrentUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    functionArea: user.functionArea,
    managerId: user.managerId,
    groups,
  };
  req.currentUser = current;
}

/** Reject unless the caller's role meets or exceeds one of the allowed roles. */
export function authorise(...allowed: UserRole[]) {
  const minPrecedence = Math.min(...allowed.map((r) => ROLE_PRECEDENCE[r]));
  return async (req: FastifyRequest): Promise<void> => {
    if (ROLE_PRECEDENCE[req.currentUser.role] < minPrecedence) {
      throw Errors.forbidden();
    }
  };
}

/**
 * Assessment-scoped guard: allow the owner, the owner's direct manager (single
 * level — no skip-level, spec §3.3), or an ELT/ADMIN_CALIBRATOR caller.
 */
export async function assertOwnerOrManager(
  req: FastifyRequest,
  assessment: { userId: string },
): Promise<void> {
  const u = req.currentUser;
  if (u.role === 'ELT' || u.role === 'ADMIN_CALIBRATOR') return;
  if (assessment.userId === u.id) return;

  const owner = await prisma.user.findUnique({
    where: { id: assessment.userId },
    select: { managerId: true },
  });
  if (owner?.managerId === u.id) return;

  throw Errors.forbidden();
}
