import { Link } from 'react-router-dom';
import { LEVEL_LABELS, type Level } from '@ai-fluency/shared';
import { Card } from '../components/ui.js';
import type { Me } from '../lib/types.js';

const LADDER: { level: Level; blurb: string }[] = [
  { level: 0, blurb: 'Does not use AI tools.' },
  { level: 1, blurb: 'Uses AI reactively for basic tasks.' },
  { level: 2, blurb: 'Uses AI intentionally; iterates on prompts.' },
  { level: 3, blurb: 'AI is a design input; builds and adapts workflows.' },
  { level: 4, blurb: 'Shapes how AI is used across teams; sets strategy.' },
];

export function Home({ me }: { me: Me }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {me.name.split(' ')[0]}</h1>
        <p className="mt-1 text-gray-600">
          This is a development tool, not a performance rating. It helps you and your manager
          have an honest conversation about AI fluency. Cycle: <strong>{me.currentCycle}</strong>.
        </p>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">The AI Fluency Ladder</h2>
        <ul className="space-y-2">
          {LADDER.map((l) => (
            <li key={l.level} className="flex gap-3 text-sm">
              <span className="w-32 shrink-0 font-semibold text-brand">{LEVEL_LABELS[l.level]}</span>
              <span className="text-gray-600">{l.blurb}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Link to="/self-assessment" className="inline-block rounded-md bg-brand px-5 py-3 font-medium text-white hover:bg-brand-dark">
        Start my self-assessment →
      </Link>
    </div>
  );
}
