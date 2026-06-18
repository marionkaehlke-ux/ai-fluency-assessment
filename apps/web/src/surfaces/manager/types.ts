import type { Dimension } from '@ai-fluency/shared';

export interface TeamMember {
  userId: string;
  name: string;
  functionArea: string;
  cycle: string | null;
  status: string | null;
  compositeLevel: number | null;
  flaggedForSABuilds: boolean;
  assessmentId: string | null;
  dimensions: Record<Dimension, number | null>;
}

export interface TeamOverview {
  cycle: string;
  members: TeamMember[];
}
