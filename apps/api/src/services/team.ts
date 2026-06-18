import { DIMENSIONS, type Dimension } from '@ai-fluency/shared';
import { prisma } from '../lib/prisma.js';

/** Manager Team View: direct reports + their assessment in a cycle (spec §4.2). */
export interface TeamOverview {
  cycle: string;
  members: Array<{
    userId: string;
    name: string;
    functionArea: string;
    cycle: string | null;
    status: string | null;
    compositeLevel: number | null;
    flaggedForSABuilds: boolean;
    assessmentId: string | null;
    dimensions: Record<Dimension, number | null>;
  }>;
}

export async function getTeamOverview(managerId: string, cycle: string): Promise<TeamOverview> {
  const reports = await prisma.user.findMany({
    where: { managerId },
    select: {
      id: true,
      name: true,
      functionArea: true,
      // Fetch current cycle first; fall back to most recent assessment if none exists.
      assessments: {
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: {
          id: true,
          cycle: true,
          status: true,
          compositeLevel: true,
          calibration: { select: { flaggedForSABuilds: true } },
          dimensionScores: { select: { dimension: true, agreedLevel: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const members = reports.map((r) => {
    // Prefer the assessment for the requested cycle; fall back to most recent.
    const a = r.assessments.find((x) => x.cycle === cycle) ?? r.assessments[0];
    const dimensions = DIMENSIONS.reduce(
      (acc, d) => ({ ...acc, [d]: null as number | null }),
      {} as Record<Dimension, number | null>,
    );
    if (a) for (const ds of a.dimensionScores) dimensions[ds.dimension] = ds.agreedLevel;
    return {
      userId: r.id,
      name: r.name,
      functionArea: r.functionArea,
      cycle: a?.cycle ?? null,
      status: a?.status ?? null,
      compositeLevel: a?.compositeLevel ?? null,
      flaggedForSABuilds: a?.calibration?.flaggedForSABuilds ?? false,
      assessmentId: a?.id ?? null,
      dimensions,
    };
  });

  return { cycle, members };
}
