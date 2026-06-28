import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LEVEL_LABELS, type Level } from '@ai-fluency/shared';
import { api } from '../lib/api.js';
import { Button, Card, Spinner } from '../components/ui.js';
import type { Assessment, Me } from '../lib/types.js';

const LADDER: { level: Level; blurb: string }[] = [
  { level: 0, blurb: 'Does not use AI tools.' },
  { level: 1, blurb: 'Uses AI reactively for basic tasks.' },
  { level: 2, blurb: 'Uses AI intentionally; iterates on prompts.' },
  { level: 3, blurb: 'AI is a design input; builds and adapts workflows.' },
  { level: 4, blurb: 'Shapes how AI is used across teams; sets strategy.' },
];

type PeriodOption = 'last-1-month' | 'last-2-months' | 'last-3-months' | 'custom';

const PERIOD_OPTIONS: { value: PeriodOption; label: string }[] = [
  { value: 'last-1-month', label: 'Last month' },
  { value: 'last-2-months', label: 'Last 2 months' },
  { value: 'last-3-months', label: 'Last 3 months' },
];

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultCustomDates() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  return { start: formatDate(start), end: formatDate(end) };
}

function buildPeriodParam(period: PeriodOption, custom: { start: string; end: string }) {
  if (period === 'custom') return `custom:${custom.start}:${custom.end}`;
  return period;
}

function PeriodPicker({
  hasProgress,
  onStart,
}: {
  hasProgress: boolean;
  onStart: (period: string) => void;
}) {
  const [selected, setSelected] = useState<PeriodOption | null>(null);
  const [custom, setCustom] = useState(defaultCustomDates);

  const isCustomValid =
    selected !== 'custom' || (custom.start.length === 10 && custom.end.length === 10 && custom.start < custom.end);

  const canProceed = selected !== null && isCustomValid;

  return (
    <Card>
      <p className="mb-4 text-sm font-medium text-gray-700">
        Which period would you like me to assess?
      </p>
      <div className="space-y-2">
        {PERIOD_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-200 px-4 py-3 text-sm hover:border-brand hover:bg-blue-50 has-[:checked]:border-brand has-[:checked]:bg-blue-50">
            <input
              type="radio"
              name="period"
              value={opt.value}
              checked={selected === opt.value}
              onChange={() => setSelected(opt.value)}
              className="accent-brand"
            />
            {opt.label}
          </label>
        ))}
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 px-4 py-3 text-sm hover:border-brand hover:bg-blue-50 has-[:checked]:border-brand has-[:checked]:bg-blue-50">
          <input
            type="radio"
            name="period"
            value="custom"
            checked={selected === 'custom'}
            onChange={() => setSelected('custom')}
            className="mt-0.5 accent-brand"
          />
          <span>
            Custom date range
            {selected === 'custom' && (
              <span className="mt-2 flex flex-wrap gap-3">
                <span className="flex items-center gap-1">
                  <span className="text-gray-500">From</span>
                  <input
                    type="date"
                    value={custom.start}
                    max={custom.end}
                    onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))}
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-gray-500">To</span>
                  <input
                    type="date"
                    value={custom.end}
                    min={custom.start}
                    max={formatDate(new Date())}
                    onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))}
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  />
                </span>
              </span>
            )}
          </span>
        </label>
      </div>
      <div className="mt-4">
        <Button
          disabled={!canProceed}
          onClick={() => onStart(buildPeriodParam(selected!, custom))}
        >
          {hasProgress ? 'Continue my self-assessment →' : 'Start my self-assessment →'}
        </Button>
      </div>
    </Card>
  );
}

function AssessmentStatus({ me }: { me: Me }) {
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ['assessment', 'draft', me.currentCycle],
    queryFn: () => api.post<Assessment>('/assessments', { cycle: me.currentCycle }),
  });

  if (q.isLoading) return <Spinner />;

  const a = q.data;

  if (!a || a.status === 'DRAFT') {
    const hasProgress = !!(a?.openingResponse || a?.dimensionScores.some((d) => d.employeeResponse));
    return (
      <PeriodPicker
        hasProgress={hasProgress}
        onStart={(period) => navigate(`/self-assessment?period=${encodeURIComponent(period)}`)}
      />
    );
  }

  if (a.status === 'SELF_SUBMITTED') {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-semibold">Assessment submitted</p>
          <p className="mt-1">
            Your responses have been scored. Review your AI-suggested levels and wait for your
            manager to schedule a calibration 1:1.
          </p>
        </div>
        <Link
          to="/self-assessment"
          className="inline-block text-sm font-medium text-brand underline hover:opacity-80"
        >
          View your suggested levels →
        </Link>
      </div>
    );
  }

  if (a.status === 'CALIBRATED') {
    const composite = a.compositeLevel;
    return (
      <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <p className="font-semibold">
          Calibrated{composite != null ? ` — ${LEVEL_LABELS[Math.round(composite) as Level]}` : ''}
        </p>
        <p className="mt-1">
          Your manager has confirmed your agreed levels for {me.currentCycle}. Nothing more to do
          until the next cycle.
        </p>
      </div>
    );
  }

  if (a.status === 'ARCHIVED') {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <p className="font-semibold">Assessment archived</p>
        <p className="mt-1">This cycle's assessment has been archived. A new cycle will open soon.</p>
      </div>
    );
  }

  return null;
}

export function Home({ me }: { me: Me }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {me.name.split(' ')[0]}</h1>
        <p className="mt-1 text-gray-600">
          This is a development tool, not a performance rating. It offers you a self assessment
          report and helps you and your manager have an honest conversation about your AI fluency.
          It also offers ideas for upskilling.
        </p>
      </div>

      <AssessmentStatus me={me} />

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
    </div>
  );
}
