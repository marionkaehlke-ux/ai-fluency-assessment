/**
 * One-off script: sync functionArea and managerId for all users from Personio.
 * Run with: npx tsx scripts/backfill-personio.ts
 * Requires PERSONIO_CLIENT_ID, PERSONIO_CLIENT_SECRET, and DATABASE_URL in env.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PersonioEmployee {
  id: number;
  attributes: {
    email: { value: string };
    department: { value: { name: string } | null };
    supervisor: { value: { id: number; attributes: { email: { value: string } } } | null };
  };
}

async function getToken(): Promise<string> {
  const res = await fetch('https://api.personio.de/v1/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.PERSONIO_CLIENT_ID,
      client_secret: process.env.PERSONIO_CLIENT_SECRET,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Personio auth failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { success: boolean; data: { token: string } };
  if (!body.success) throw new Error('Personio auth returned success=false');
  return body.data.token;
}

async function getAllPersonioEmployees(token: string): Promise<PersonioEmployee[]> {
  const employees: PersonioEmployee[] = [];
  let page = 1;
  const limit = 200;

  while (true) {
    const res = await fetch(
      `https://api.personio.de/v1/company/employees?limit=${limit}&offset=${(page - 1) * limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Personio-Partner-ID': process.env.PERSONIO_CLIENT_ID ?? '',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!res.ok) throw new Error(`Personio employees fetch failed: ${res.status}`);
    const body = (await res.json()) as { success: boolean; data: PersonioEmployee[] };
    employees.push(...body.data);
    if (body.data.length < limit) break;
    page++;
  }

  return employees;
}

async function main() {
  if (!process.env.PERSONIO_CLIENT_ID || !process.env.PERSONIO_CLIENT_SECRET) {
    console.error('Missing PERSONIO_CLIENT_ID or PERSONIO_CLIENT_SECRET');
    process.exit(1);
  }

  console.log('Authenticating with Personio...');
  const token = await getToken();

  console.log('Fetching all Personio employees...');
  const personioEmployees = await getAllPersonioEmployees(token);
  console.log(`Found ${personioEmployees.length} employees in Personio`);

  // Build a lookup map: email → { functionArea, managerEmail }
  const byEmail = new Map<string, { functionArea: string; managerEmail: string | null }>();
  for (const e of personioEmployees) {
    const email = e.attributes.email.value?.toLowerCase();
    if (!email) continue;
    byEmail.set(email, {
      functionArea: e.attributes.department?.value?.name ?? 'UNASSIGNED',
      managerEmail:
        e.attributes.supervisor?.value?.attributes?.email?.value?.toLowerCase() ?? null,
    });
  }

  console.log('Fetching all users from DB...');
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  console.log(`Found ${users.length} users in DB`);

  let updated = 0;
  let notFound = 0;

  for (const user of users) {
    const personio = byEmail.get(user.email.toLowerCase());
    if (!personio) {
      console.log(`  ✗ Not found in Personio: ${user.email}`);
      notFound++;
      continue;
    }

    // Resolve managerId from manager's email
    let managerId: string | null = null;
    if (personio.managerEmail) {
      const manager = await prisma.user.findUnique({
        where: { email: personio.managerEmail },
        select: { id: true },
      });
      managerId = manager?.id ?? null;
      if (!manager) {
        console.log(`  ⚠ Manager not in DB yet for ${user.email}: ${personio.managerEmail}`);
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { functionArea: personio.functionArea, managerId },
    });
    console.log(
      `  ✓ ${user.email} → ${personio.functionArea}, manager: ${personio.managerEmail ?? 'none'}`,
    );
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Not in Personio: ${notFound}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
