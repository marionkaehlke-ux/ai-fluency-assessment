/** Standard response envelope { data, error, meta } (spec §7.1). */

export interface ApiMeta {
  [key: string]: unknown;
}

/** RFC 7807 Problem Details (spec §7.1). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

export interface ApiEnvelope<T> {
  data: T | null;
  error: ProblemDetails | null;
  meta?: ApiMeta;
}

export function ok<T>(data: T, meta?: ApiMeta): ApiEnvelope<T> {
  return { data, error: null, ...(meta ? { meta } : {}) };
}

export function fail(error: ProblemDetails): ApiEnvelope<never> {
  return { data: null, error };
}
