import { config } from '../config.js';

interface PersonioEmployee {
  id: number;
  attributes: {
    email: { value: string };
    department: { value: { name: string } | null };
    supervisor: { value: { id: number; attributes: { email: { value: string } } } | null };
  };
}

interface PersonioResponse {
  success: boolean;
  data: PersonioEmployee[];
}

/**
 * Look up an employee in Personio by their phrase.com email.
 * Returns the fields we care about: functionArea (department) and manager email.
 * Returns null when the employee isn't found or Personio is unreachable — the
 * caller falls back to existing DB values in that case.
 */
export async function getPersonioEmployee(
  email: string,
): Promise<{ functionArea: string; managerEmail: string | null } | null> {
  if (!config.PERSONIO_API_KEY || !config.PERSONIO_PARTNER_ID) return null;

  let token: string;
  try {
    token = await authenticate();
  } catch {
    return null;
  }

  let res: Response;
  try {
    res = await fetch(
      `https://api.personio.de/v1/company/employees?filter[email]=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Personio-Partner-ID': config.PERSONIO_PARTNER_ID,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      },
    );
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const body = (await res.json()) as PersonioResponse;
  const employee = body.data?.[0];
  if (!employee) return null;

  const department = employee.attributes.department?.value?.name ?? 'UNASSIGNED';
  const managerEmail =
    employee.attributes.supervisor?.value?.attributes?.email?.value ?? null;

  return { functionArea: department, managerEmail };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function authenticate(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const res = await fetch('https://api.personio.de/v1/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: config.PERSONIO_PARTNER_ID,
      client_secret: config.PERSONIO_API_KEY,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) throw new Error(`Personio auth failed: ${res.status}`);

  const body = (await res.json()) as { success: boolean; data: { token: string } };
  if (!body.success) throw new Error('Personio auth returned success=false');

  cachedToken = {
    value: body.data.token,
    // Personio tokens last 24h — we cache for 23h to be safe.
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  };
  return cachedToken.value;
}
