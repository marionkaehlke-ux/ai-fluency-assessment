import type { AssessmentStatus, Dimension, UserRole } from '@ai-fluency/shared';

export interface Me {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  functionArea: string;
  managerId: string | null;
  currentCycle: string;
}

export interface DimensionScore {
  id: string;
  dimension: Dimension;
  employeeResponse: string | null;
  managerNotes: string | null;
  aiSuggestedLevel: number | null;
  aiRationale: string | null;
  agreedLevel: number | null;
}

export interface Assessment {
  id: string;
  userId: string;
  cycle: string;
  status: AssessmentStatus;
  openingResponse: string | null;
  selfRatedLevel: number | null;
  compositeLevel: number | null;
  aiNarrative: string | null;
  scoringFailed: boolean;
  updatedAt: string;
  dimensionScores: DimensionScore[];
  calibration: { flaggedForSABuilds: boolean; conductedAt: string } | null;
}
