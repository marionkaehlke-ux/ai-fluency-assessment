import type { ProblemDetails } from '@ai-fluency/shared';

/**
 * Application error carrying an RFC 7807 Problem Details payload (spec §7.1).
 * Thrown by services and routes; translated to the response envelope by the
 * global error handler in app.ts.
 */
export class AppError extends Error {
  readonly status: number;
  readonly type: string;
  readonly title: string;
  readonly extra: Record<string, unknown>;

  constructor(
    status: number,
    title: string,
    detail?: string,
    opts: { type?: string; extra?: Record<string, unknown> } = {},
  ) {
    super(detail ?? title);
    this.name = 'AppError';
    this.status = status;
    this.title = title;
    this.type = opts.type ?? 'about:blank';
    this.extra = opts.extra ?? {};
  }

  toProblem(instance?: string): ProblemDetails {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.message,
      ...(instance ? { instance } : {}),
      ...this.extra,
    };
  }
}

export const Errors = {
  unauthorized: (detail = 'Authentication required.') => new AppError(401, 'Unauthorized', detail),
  forbidden: (detail = "You don't have permission to view this.") =>
    new AppError(403, 'Forbidden', detail),
  notFound: (detail = 'Resource not found.') => new AppError(404, 'Not Found', detail),
  conflict: (detail = 'Someone else updated this assessment. Reload to see the latest version.') =>
    new AppError(409, 'Conflict', detail),
  validation: (detail: string, extra?: Record<string, unknown>) =>
    new AppError(422, 'Unprocessable Entity', detail, { extra }),
  scoringUnavailable: (
    detail = "We couldn't score your responses right now. Your answers are saved — try again in a few minutes.",
  ) => new AppError(503, 'Scoring Unavailable', detail),
};
