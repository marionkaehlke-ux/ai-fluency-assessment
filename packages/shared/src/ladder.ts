/**
 * The Phrase AI Fluency Ladder (spec §12.1 / §12.2).
 * Five levels (L0–L4) across four dimensions. Shared by backend scoring,
 * backend composite computation, and frontend display.
 */

export const DIMENSIONS = ['MINDSET', 'STRATEGY', 'BUILDING', 'ACCOUNTABILITY'] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/** Lower-case dimension key used in the Claude JSON contract (spec §7.3). */
export const DIMENSION_KEYS = {
  MINDSET: 'mindset',
  STRATEGY: 'strategy',
  BUILDING: 'building',
  ACCOUNTABILITY: 'accountability',
} as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[Dimension];

export const LEVEL_MIN = 0;
export const LEVEL_MAX = 4;
export type Level = 0 | 1 | 2 | 3 | 4;

export const LEVEL_LABELS: Record<Level, string> = {
  0: 'L0 — Non-adopter',
  1: 'L1 — Passive User',
  2: 'L2 — Proficient',
  3: 'L3 — AI-native',
  4: 'L4 — Multiplier',
};

/** Equal-weighted (25% each) composite in the MVP (spec §12.2). */
export const DIMENSION_WEIGHT = 0.25;

/**
 * Maps a composite score (weighted average of agreed levels) to an overall level.
 * Boundaries per spec §12.2.
 */
export function compositeToLevel(composite: number): Level {
  if (composite < 1.0) return 0;
  if (composite < 1.75) return 1;
  if (composite < 2.5) return 2;
  if (composite < 3.5) return 3;
  return 4;
}

/**
 * Composite = equal-weighted average of the four agreed levels.
 * IMPORTANT: callers must pass agreedLevel values only, never aiSuggestedLevel
 * (spec §7a.3 / CLAUDE.md data-integrity rule).
 */
export function computeComposite(agreedLevels: number[]): number {
  if (agreedLevels.length !== DIMENSIONS.length) {
    throw new Error(
      `computeComposite requires exactly ${DIMENSIONS.length} agreed levels, got ${agreedLevels.length}`,
    );
  }
  const sum = agreedLevels.reduce((a, b) => a + b * DIMENSION_WEIGHT, 0);
  return Number(sum.toFixed(4));
}
