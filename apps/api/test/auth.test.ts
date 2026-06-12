import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';
import type { CurrentUser } from '../src/types.js';

// Prisma is mocked so assertOwnerOrManager can be tested without a database.
vi.mock('../src/lib/prisma.js', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

import { prisma } from '../src/lib/prisma.js';
import {
  assertOwnerOrManager,
  authorise,
  decodeUserInfo,
  resolveRole,
} from '../src/middleware/auth.js';

const findUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;

function reqWith(role: CurrentUser['role'], id = 'u1'): FastifyRequest {
  return { currentUser: { id, role } } as unknown as FastifyRequest;
}

beforeEach(() => findUnique.mockReset());

describe('decodeUserInfo', () => {
  it('decodes a base64 JSON claims blob', () => {
    const header = Buffer.from(JSON.stringify({ sub: 'x', email: 'A@Phrase.com', groups: ['g'] })).toString('base64');
    const info = decodeUserInfo(header);
    expect(info.email).toBe('A@Phrase.com');
    expect(info.groups).toEqual(['g']);
  });

  it('throws when the email claim is missing', () => {
    const header = Buffer.from(JSON.stringify({ sub: 'x' })).toString('base64');
    expect(() => decodeUserInfo(header)).toThrow();
  });
});

describe('resolveRole', () => {
  it('returns ADMIN_CALIBRATOR for the People Ops group (highest precedence)', () => {
    // ELT email + admin group → admin wins.
    expect(resolveRole('marion.kaehlke@phrase.com', ['phrase-people-ops'], true)).toBe('ADMIN_CALIBRATOR');
  });

  it('returns ELT for a seeded ELT email', () => {
    expect(resolveRole('elt@phrase.com', [], false)).toBe('ELT');
  });

  it('returns MANAGER when the user has reports and is not ELT', () => {
    expect(resolveRole('someone@phrase.com', [], true)).toBe('MANAGER');
  });

  it('defaults to EMPLOYEE', () => {
    expect(resolveRole('someone@phrase.com', [], false)).toBe('EMPLOYEE');
  });
});

describe('authorise', () => {
  it('allows a role meeting the threshold and rejects one below it', async () => {
    const guard = authorise('ELT');
    await expect(guard(reqWith('ELT'))).resolves.toBeUndefined();
    await expect(guard(reqWith('ADMIN_CALIBRATOR'))).resolves.toBeUndefined(); // higher precedence
    await expect(guard(reqWith('MANAGER'))).rejects.toMatchObject({ status: 403 });
    await expect(guard(reqWith('EMPLOYEE'))).rejects.toMatchObject({ status: 403 });
  });
});

describe('assertOwnerOrManager', () => {
  it('allows ELT and ADMIN_CALIBRATOR without a DB lookup', async () => {
    await expect(assertOwnerOrManager(reqWith('ELT'), { userId: 'other' })).resolves.toBeUndefined();
    await expect(assertOwnerOrManager(reqWith('ADMIN_CALIBRATOR'), { userId: 'other' })).resolves.toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('allows the owner', async () => {
    await expect(assertOwnerOrManager(reqWith('EMPLOYEE', 'u1'), { userId: 'u1' })).resolves.toBeUndefined();
  });

  it('allows the direct manager', async () => {
    findUnique.mockResolvedValue({ managerId: 'u1' });
    await expect(assertOwnerOrManager(reqWith('MANAGER', 'u1'), { userId: 'emp' })).resolves.toBeUndefined();
  });

  it('forbids a non-owner, non-manager', async () => {
    findUnique.mockResolvedValue({ managerId: 'someone-else' });
    await expect(assertOwnerOrManager(reqWith('MANAGER', 'u1'), { userId: 'emp' })).rejects.toMatchObject({ status: 403 });
  });
});
