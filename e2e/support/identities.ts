// Fixed identities and seeded record IDs shared by the seed script and the specs.
// In production the gateway injects X-Userinfo; in E2E each browser context sets it directly.

export function userinfo(email: string, name: string, groups: string[] = []): string {
  return Buffer.from(JSON.stringify({ sub: email, email, name, groups })).toString('base64');
}

export const IDS = {
  manager: '00000000-0000-4000-8000-000000000001',
  employeeForMgr: '00000000-0000-4000-8000-000000000002',
  assessmentAi: '00000000-0000-4000-8000-000000000003',
  employee2: '00000000-0000-4000-8000-000000000004',
  assessmentNoAi: '00000000-0000-4000-8000-000000000005',
} as const;

export const EMAILS = {
  // Fresh users (created on first login) — no seeding needed.
  newEmployee: 'newgrad.e2e@phrase.com',
  failEmployee: 'fail.e2e@phrase.com',
  // Seeded users.
  manager: 'mgr.e2e@phrase.com',
  employeeForMgr: 'emp.e2e@phrase.com',
  employee2: 'emp2.e2e@phrase.com',
  // Must be present in the API's ELT_EMAILS env.
  elt: 'elt.e2e@phrase.com',
} as const;

export const CYCLE = '2026-H1';

/** Sentinel the mock Anthropic server detects to force a scoring failure (path 4). */
export const FAILMODE = 'FAILMODE';
