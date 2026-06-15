/**
 * Re-export of the canonical scoring contract (defined in @ai-fluency/shared so the
 * frontend and tests share it). CLAUDE.md references this path — keep it as the
 * backend entry point for the scoring schema.
 */
export { scoringSchema, type ScoringResult, type DimensionResult } from '@ai-fluency/shared';
