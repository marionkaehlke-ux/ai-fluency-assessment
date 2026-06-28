import { z } from 'zod';
import {
  DIMENSIONS,
  LEVEL_MAX,
  LEVEL_MIN,
  dimensionResponseSchema,
  openingResponseSchema,
} from '@ai-fluency/shared';

const dimensionEnum = z.enum(DIMENSIONS);
const levelSchema = z.number().int().min(LEVEL_MIN).max(LEVEL_MAX);

/** Optimistic-lock token: clients echo the updatedAt of the record they last loaded. */
const expectedUpdatedAt = z.coerce.date();

export const createAssessmentSchema = z.object({
  cycle: z.string().regex(/^\d{4}-W\d{2}$/, 'cycle must look like 2026-W25'),
});

/** Draft autosave — partial responses allowed (no length floor until submit). */
export const saveDraftSchema = z.object({
  expectedUpdatedAt,
  openingResponse: z.string().max(2000).optional(),
  selfRatedLevel: levelSchema.optional(),
  responses: z
    .array(z.object({ dimension: dimensionEnum, employeeResponse: z.string().max(2000) }))
    .max(4)
    .optional(),
});

/** Submit — full validation of all four responses + opening (spec §4.1, §8.4). */
export const submitSchema = z.object({
  expectedUpdatedAt,
  openingResponse: openingResponseSchema,
  selfRatedLevel: levelSchema.optional(),
  responses: z
    .array(z.object({ dimension: dimensionEnum, employeeResponse: dimensionResponseSchema }))
    .length(4)
    .refine(
      (arr) => new Set(arr.map((r) => r.dimension)).size === 4,
      'all four dimensions must be present exactly once',
    ),
});

/**
 * Calibrate — the human gate. manager_confirmed MUST be true or the API rejects
 * (spec §7a.3 / CLAUDE.md). agreedLevel is written only through this path.
 */
export const calibrateSchema = z.object({
  expectedUpdatedAt,
  manager_confirmed: z.literal(true, {
    errorMap: () => ({ message: 'manager_confirmed must be true to calibrate' }),
  }),
  conductedAt: z.coerce.date().optional(),
  flaggedForSABuilds: z.boolean().optional(),
  dimensions: z
    .array(
      z.object({
        dimension: dimensionEnum,
        agreedLevel: levelSchema,
        managerNotes: z.string().max(4000).optional(),
      }),
    )
    .length(4)
    .refine(
      (arr) => new Set(arr.map((r) => r.dimension)).size === 4,
      'all four dimensions must be present exactly once',
    ),
});

export type CreateAssessmentBody = z.infer<typeof createAssessmentSchema>;
export type SaveDraftBody = z.infer<typeof saveDraftSchema>;
export type SubmitBody = z.infer<typeof submitSchema>;
export type CalibrateBody = z.infer<typeof calibrateSchema>;
