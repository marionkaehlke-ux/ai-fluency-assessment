import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DIMENSIONS, compositeToLevel, LEVEL_LABELS, type Level } from '@ai-fluency/shared';
import { api } from '../../lib/api.js';
import { Badge, Card, ErrorBanner, Spinner } from '../../components/ui.js';
import type { Me } from '../../lib/types.js';
import type { TeamOverview } from './types.js';

export function TeamView({ me }: { me: Me }) {
  const q = useQuery({
    queryKey: ['team', me.id, me.currentCycle],
    queryFn: () => api.get<TeamOverview>(`/team/${me.id}/overview?cycle=${me.currentCycle}`),
  });

  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorBanner message={(q.error as Error)?.message ?? 'Failed to load team.'} />;

  const { members } = q.data;
  const dist: Record<Level, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const m of members) if (m.compositeLevel != null) dist[compositeToLevel(m.compositeLevel)] += 1;
  const chartData = (Object.keys(dist) as unknown as Level[]).map((l) => ({
    level: `L${l}`,
    count: dist[l],
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My team — {me.currentCycle}</h1>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Level distribution</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">Name</th>
              <th>Cycle</th>
              <th>Status</th>
              <th>Composite</th>
              {DIMENSIONS.map((d) => (
                <th key={d} className="text-center">{d.slice(0, 4)}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId} className="border-b border-gray-100">
                <td className="py-2 font-medium">
                  {m.name} {m.flaggedForSABuilds && <Badge>SA Builds</Badge>}
                </td>
                <td className="text-gray-500 text-xs">
                  {m.cycle ?? '—'}
                  {m.cycle && m.cycle !== me.currentCycle && (
                    <span className="ml-1 text-orange-400">(prev)</span>
                  )}
                </td>
                <td className="text-gray-600">{m.status ?? 'Not started'}</td>
                <td>{m.compositeLevel != null ? LEVEL_LABELS[compositeToLevel(m.compositeLevel)] : '—'}</td>
                {DIMENSIONS.map((d) => (
                  <td key={d} className="text-center">{m.dimensions[d] ?? '—'}</td>
                ))}
                <td className="text-right">
                  {m.assessmentId && m.status === 'SELF_SUBMITTED' && (
                    <Link className="text-brand hover:underline" to={`/manager/calibrate/${m.assessmentId}`}>
                      Calibrate →
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && <p className="py-4 text-sm text-gray-500">No direct reports found.</p>}
      </Card>
    </div>
  );
}
