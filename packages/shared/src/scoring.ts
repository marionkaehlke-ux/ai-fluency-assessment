import { z } from 'zod';

/**
 * Strict contract for Claude's scoring output (spec §7.3 / §7a.2).
 * EVERY Claude response must pass scoringSchema.parse() before any DB write.
 * An out-of-range level (e.g. 5) or missing dimension must never reach the DB.
 */
const dimensionResult = z.object({
  level: z.number().int().min(0).max(4),
  rationale: z.string().min(1).max(500),
});

export const scoringSchema = z.object({
  mindset: dimensionResult,
  strategy: dimensionResult,
  building: dimensionResult,
  accountability: dimensionResult,
});

export type ScoringResult = z.infer<typeof scoringSchema>;
export type DimensionResult = z.infer<typeof dimensionResult>;

/** Input validation bounds for employee free-text (spec §8.4 prompt-injection control). */
export const RESPONSE_MIN_CHARS = 80;
export const RESPONSE_MAX_CHARS = 2000;
export const OPENING_MIN_CHARS = 0;

export const dimensionResponseSchema = z
  .string()
  .trim()
  .min(RESPONSE_MIN_CHARS, `Response must be at least ${RESPONSE_MIN_CHARS} characters`)
  .max(RESPONSE_MAX_CHARS, `Response must be at most ${RESPONSE_MAX_CHARS} characters`);

export const openingResponseSchema = z
  .string()
  .trim()
  .max(RESPONSE_MAX_CHARS);
