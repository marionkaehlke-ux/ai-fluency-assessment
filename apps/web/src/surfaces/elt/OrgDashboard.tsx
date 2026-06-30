import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DIMENSIONS, LEVEL_LABELS, type Dimension, type Level } from '@ai-fluency/shared';
import { api } from '../../lib/api.js';
import { Button, Card, ErrorBanner, Spinner } from '../../components/ui.js';

interface OrgDashboardData {
  totalAssessed: number;
  cycle: string | null;
  compositeDistribution: Record<Level, number>;
  dimensionAverages: Record<Dimension, number>;
  functionBreakdown: Array<{ functionArea: string; count: number; averageComposite: number }>;
}

const CYCLES = ['2026-H1', '2026-H2', '2025-H1', '2025-H2'];

export function OrgDashboard() {
  const [cycle, setCycle] = useState<string>('2026-H1');

  const q = useQuery({
    queryKey: ['org', 'dashboard', cycle],
    queryFn: () => api.get<OrgDashboardData>(`/org/dashboard?cycle=${cycle}`),
  });

  const narrative = useMutation({
    mutationFn: () => api.post<{ narrative: string }>(`/org/narrative?cycle=${cycle}`),
  });

  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorBanner message={(q.error as Error)?.message ?? 'Failed to load.'} />;
  const d = q.data;

  const distData = (Object.keys(d.compositeDistribution) as unknown as Level[]).map((l) => ({
    level: `L${l}`,
    count: d.compositeDistribution[l],
  }));
  const radarData = DIMENSIONS.map((dim) => ({ dimension: dim, value: d.dimensionAverages[dim] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organisation — AI fluency</h1>
        <div className="flex items-center gap-3">
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={cycle}
            onChange={(e) => {
              setCycle(e.target.value);
              narrative.reset();
            }}
          >
            {CYCLES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <a
            href={`/api/v1/org/export?cycle=${cycle}`}
            className="rounded-md border border-brand px-3 py-2 text-sm font-medium text-brand hover:bg-brand/10"
          >
            Export anonymised CSV
          </a>
        </div>
      </div>
      <p className="text-sm text-gray-600">
        {d.totalAssessed} calibrated assessments · {cycle}.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Overall level distribution</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="level" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2d6cdf" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Dimension averages (0–4)</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dimension" />
                <Radar dataKey="value" stroke="#2d6cdf" fill="#2d6cdf" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Function breakdown</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">Function</th>
              <th>Assessed</th>
              <th>Avg composite</th>
              <th>Overall</th>
            </tr>
          </thead>
          <tbody>
            {d.functionBreakdown.map((f) => (
              <tr key={f.functionArea} className="border-b border-gray-100">
                <td className="py-2 font-medium">{f.functionArea}</td>
                <td>{f.count}</td>
                <td>{f.averageComposite}</td>
                <td>{LEVEL_LABELS[Math.round(f.averageComposite) as Level]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {d.functionBreakdown.length === 0 && (
          <p className="py-4 text-sm text-gray-500">No calibrated data yet.</p>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">AI executive narrative</h2>
          <Button disabled={narrative.isPending} onClick={() => narrative.mutate()}>
            {narrative.isPending ? 'Generating…' : 'Generate'}
          </Button>
        </div>
        {narrative.isError && (
          <div className="mt-3"><ErrorBanner message={(narrative.error as Error).message} /></div>
        )}
        {narrative.data && <p className="mt-3 text-sm text-gray-700">{narrative.data.narrative}</p>}
      </Card>
    </div>
  );
}
