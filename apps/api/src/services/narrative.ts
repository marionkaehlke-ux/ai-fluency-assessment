import { LEVEL_LABELS, type Level } from '@ai-fluency/shared';
import { config } from '../config.js';
import { anthropic, extractText } from '../lib/anthropic.js';
import { getOrgDashboard } from './org.js';

/**
 * Generate the ~150-word ELT executive narrative on demand (spec §4.3).
 * Aggregate, anonymised statistics only — no individual employee data or PII is sent.
 */
export async function generateOrgNarrative(cycle?: string): Promise<string> {
  const dash = await getOrgDashboard(cycle);

  const distribution = (Object.entries(dash.compositeDistribution) as [string, number][])
    .map(([level, count]) => `${LEVEL_LABELS[Number(level) as Level]}: ${count}`)
    .join('; ');
  const dims = Object.entries(dash.dimensionAverages)
    .map(([d, avg]) => `${d}: ${avg}`)
    .join(', ');
  const functions = dash.functionBreakdown
    .map((f) => `${f.functionArea} (avg ${f.averageComposite}, n=${f.count})`)
    .join('; ');

  const system =
    'You are summarising an organisation’s AI fluency posture for an executive leadership team. ' +
    'Write a single concise paragraph of about 150 words. Be factual and grounded in the numbers ' +
    'provided. Do not invent data. Note the strongest and weakest dimensions and any notable ' +
    'function-level variation. This is a development signal, not a performance rating.';

  const user = [
    `Total calibrated assessments: ${dash.totalAssessed}`,
    `Cycle: ${dash.cycle ?? 'n/a'}`,
    `Overall level distribution — ${distribution}`,
    `Dimension averages (0–4) — ${dims}`,
    `Function breakdown — ${functions || 'n/a'}`,
  ].join('\n');

  const message = await anthropic.messages.create({
    model: config.CLAUDE_MODEL,
    max_tokens: 400,
    temperature: 0.3,
    system,
    messages: [{ role: 'user', content: user }],
  });
  return extractText(message).trim();
}
