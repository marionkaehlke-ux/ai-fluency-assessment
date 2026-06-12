import { DIMENSIONS, compositeToLevel, type Dimension, type Level } from '@ai-fluency/shared';
import { prisma } from '../lib/prisma.js';

/** Aggregations for the ELT dashboard (spec §4.3). Calibrated assessments only. */
export interface OrgDashboard {
  totalAssessed: number;
  cycle: string | null;
  compositeDistribution: Record<Level, number>;
  dimensionAverages: Record<Dimension, number>;
  functionBreakdown: Array<{
    functionArea: string;
    count: number;
    averageComposite: number;
    dimensionAverages: Record<Dimension, number>;
  }>;
}

type CalibratedRow = {
  cycle: string;
  compositeLevel: number | null;
  user: { functionArea: string };
  dimensionScores: { dimension: Dimension; agreedLevel: number | null }[];
};

async function loadCalibrated(cycle?: string): Promise<CalibratedRow[]> {
  return prisma.assessment.findMany({
    where: { status: 'CALIBRATED', ...(cycle ? { cycle } : {}) },
    select: {
      cycle: true,
      compositeLevel: true,
      user: { select: { functionArea: true } },
      dimensionScores: { select: { dimension: true, agreedLevel: true } },
    },
  }) as Promise<CalibratedRow[]>;
}

function emptyDimAvg(): Record<Dimension, number> {
  return DIMENSIONS.reduce(
    (acc, d) => ({ ...acc, [d]: 0 }),
    {} as Record<Dimension, number>,
  );
}

function dimensionAverages(rows: CalibratedRow[]): Record<Dimension, number> {
  const sums = emptyDimAvg();
  const counts = emptyDimAvg();
  for (const row of rows) {
    for (const ds of row.dimensionScores) {
      if (ds.agreedLevel != null) {
        sums[ds.dimension] += ds.agreedLevel;
        counts[ds.dimension] += 1;
      }
    }
  }
  const out = emptyDimAvg();
  for (const d of DIMENSIONS) out[d] = counts[d] ? Number((sums[d] / counts[d]).toFixed(2)) : 0;
  return out;
}

export async function getOrgDashboard(cycle?: string): Promise<OrgDashboard> {
  const rows = await loadCalibrated(cycle);

  const compositeDistribution: Record<Level, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of rows) {
    if (r.compositeLevel != null) compositeDistribution[compositeToLevel(r.compositeLevel)] += 1;
  }

  const byFunction = new Map<string, CalibratedRow[]>();
  for (const r of rows) {
    const arr = byFunction.get(r.user.functionArea) ?? [];
    arr.push(r);
    byFunction.set(r.user.functionArea, arr);
  }

  const functionBreakdown = [...byFunction.entries()]
    .map(([functionArea, fnRows]) => {
      const composites = fnRows.map((r) => r.compositeLevel).filter((c): c is number => c != null);
      const averageComposite = composites.length
        ? Number((composites.reduce((a, b) => a + b, 0) / composites.length).toFixed(2))
        : 0;
      return {
        functionArea,
        count: fnRows.length,
        averageComposite,
        dimensionAverages: dimensionAverages(fnRows),
      };
    })
    .sort((a, b) => b.averageComposite - a.averageComposite);

  return {
    totalAssessed: rows.length,
    cycle: cycle ?? rows[0]?.cycle ?? null,
    compositeDistribution,
    dimensionAverages: dimensionAverages(rows),
    functionBreakdown,
  };
}

/** Anonymised CSV — no name or email (spec §3.3 / §4.3). */
export async function buildExportCsv(cycle?: string): Promise<string> {
  const rows = await loadCalibrated(cycle);
  const header = [
    'cycle',
    'function_area',
    'composite_level',
    'overall_level',
    ...DIMENSIONS.map((d) => d.toLowerCase()),
  ];
  const lines = [header.join(',')];

  for (const r of rows) {
    const byDim = new Map(r.dimensionScores.map((d) => [d.dimension, d.agreedLevel]));
    const cells = [
      r.cycle,
      JSON.stringify(r.user.functionArea),
      r.compositeLevel ?? '',
      r.compositeLevel != null ? compositeToLevel(r.compositeLevel) : '',
      ...DIMENSIONS.map((d) => byDim.get(d) ?? ''),
    ];
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}
