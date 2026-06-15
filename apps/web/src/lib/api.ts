import type { ApiEnvelope, ProblemDetails } from '@ai-fluency/shared';

export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
  }
}

const BASE = '/api/v1';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
  });

  if (res.status === 401) {
    // Gateway session expired — reload so Okta re-authenticates (spec §7a.5).
    window.location.reload();
    throw new ApiError({ type: 'about:blank', title: 'Unauthorized', status: 401 });
  }

  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json') && !ct.includes('application/problem+json')) {
    if (!res.ok) throw new ApiError({ type: 'about:blank', title: 'Error', status: res.status });
    return (await res.text()) as unknown as T;
  }

  const body = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || body.error) {
    throw new ApiError(
      body.error ?? { type: 'about:blank', title: 'Error', status: res.status },
    );
  }
  return body.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
};
