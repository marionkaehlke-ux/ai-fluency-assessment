import { describe, expect, it } from 'vitest';
import { DIMENSIONS } from '@ai-fluency/shared';
import { prisma } from '../../src/lib/prisma.js';
import { buildExportCsv, getOrgDashboard } from '../../src/services/org.js';

async function seedCalibrated(
  email: string,
  functionArea: string,
  composite: number,
  agreed: number[],
): Promise<void> {
  await prisma.user.create({
    data: {
      email,
      name: `Name ${email}`,
      functionArea,
      assessments: {
        create: {
          cycle: '2026-H1',
          status: 'CALIBRATED',
          compositeLevel: composite,
          dimensionScores: { create: DIMENSIONS.map((dimension, i) => ({ dimension, agreedLevel: agreed[i]! })) },
        },
      },
    },
  });
}

describe('org dashboard & export (real DB)', () => {
  it('aggregates only calibrated assessments by level, dimension, and function', async () => {
    await seedCalibrated('a@phrase.com', 'Engineering', 3.0, [3, 3, 3, 3]);
    await seedCalibrated('b@phrase.com', 'Engineering', 2.0, [2, 2, 2, 2]);
    await seedCalibrated('c@phrase.com', 'Marketing', 1.0, [1, 1, 1, 1]);
    // A draft must be excluded from aggregates.
    await prisma.user.create({
      data: { email: 'd@phrase.com', name: 'Draft', functionArea: 'Marketing', assessments: { create: { cycle: '2026-H1', status: 'DRAFT' } } },
    });

    const dash = await getOrgDashboard('2026-H1');
    expect(dash.totalAssessed).toBe(3);
    expect(dash.compositeDistribution[3]).toBe(1); // composite 3.0 → L3
    expect(dash.compositeDistribution[2]).toBe(1);
    expect(dash.compositeDistribution[1]).toBe(1);

    const eng = dash.functionBreakdown.find((f) => f.functionArea === 'Engineering')!;
    expect(eng.count).toBe(2);
    expect(eng.averageComposite).toBe(2.5);
    // Sorted by averageComposite desc → Engineering before Marketing.
    expect(dash.functionBreakdown[0]!.functionArea).toBe('Engineering');
  });

  it('exports an anonymised CSV with no names or emails', async () => {
    await seedCalibrated('secret.person@phrase.com', 'Engineering', 3.0, [3, 3, 3, 3]);
    const csv = await buildExportCsv('2026-H1');

    expect(csv.split('\n')[0]).toBe('cycle,function_area,composite_level,overall_level,mindset,strategy,building,accountability');
    expect(csv).toContain('Engineering');
    expect(csv).not.toContain('secret.person@phrase.com');
    expect(csv).not.toContain('Name secret.person');
  });
});
