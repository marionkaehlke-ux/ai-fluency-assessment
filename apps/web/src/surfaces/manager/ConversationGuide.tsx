import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DIMENSIONS, LEVEL_LABELS, LEVEL_MAX, LEVEL_MIN, type Dimension, type Level } from '@ai-fluency/shared';
import { api } from '../../lib/api.js';
import { Button, Card, ErrorBanner, Spinner } from '../../components/ui.js';
import type { Assessment } from '../../lib/types.js';

type Draft = Record<Dimension, { agreedLevel: number; managerNotes: string }>;

export function ConversationGuide() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['assessment', id],
    queryFn: () => api.get<Assessment>(`/assessments/${id}`),
    enabled: !!id,
  });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!q.data || draft) return;
    const initial = {} as Draft;
    for (const ds of q.data.dimensionScores) {
      initial[ds.dimension] = {
        // Pre-fill with the AI suggestion as a starting point — the manager must still confirm.
        agreedLevel: ds.agreedLevel ?? ds.aiSuggestedLevel ?? 0,
        managerNotes: ds.managerNotes ?? '',
      };
    }
    setDraft(initial);
  }, [q.data, draft]);

  const calibrate = useMutation({
    mutationFn: () =>
      api.post<Assessment>(`/assessments/${id}/calibrate`, {
        expectedUpdatedAt: q.data!.updatedAt,
        manager_confirmed: true,
        dimensions: DIMENSIONS.map((d) => ({
          dimension: d,
          agreedLevel: draft![d].agreedLevel,
          managerNotes: draft![d].managerNotes,
        })),
      }),
    onSuccess: (data) => qc.setQueryData(['assessment', id], data),
  });

  if (q.isLoading || !draft) return <Spinner />;
  if (q.isError || !q.data) return <ErrorBanner message={(q.error as Error)?.message ?? 'Failed to load.'} />;

  const a = q.data;
  const scoringUnavailable = a.scoringFailed && a.dimensionScores.every((d) => d.aiSuggestedLevel == null);
  const isCalibrated = a.status === 'CALIBRATED';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Conversation guide</h1>
      {isCalibrated && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          This assessment is calibrated. Agreed levels are final for {a.cycle}.
        </div>
      )}
      {scoringUnavailable && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          AI scoring is unavailable for this employee. You can still run the conversation and enter
          agreed levels manually.
        </div>
      )}

      {a.openingResponse && (
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-gray-700">Opening reflection</h2>
          <p className="text-sm text-gray-600">{a.openingResponse}</p>
        </Card>
      )}

      {DIMENSIONS.map((d) => {
        const ds = a.dimensionScores.find((x) => x.dimension === d)!;
        return (
          <Card key={d}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand">{d}</p>
            <p className="mb-2 text-sm text-gray-700">{ds.employeeResponse}</p>

            {ds.aiSuggestedLevel != null && (
              <p className="mb-3 text-xs text-amber-700">
                AI suggestion — review with your employee:{' '}
                <strong>{LEVEL_LABELS[ds.aiSuggestedLevel as Level]}</strong> · {ds.aiRationale}
              </p>
            )}

            <label className="block text-sm font-medium">Agreed level</label>
            <select
              className="mt-1 rounded-md border border-gray-300 p-2 text-sm"
              disabled={isCalibrated}
              value={draft[d].agreedLevel}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev!, [d]: { ...prev![d], agreedLevel: Number(e.target.value) } }))
              }
            >
              {Array.from({ length: LEVEL_MAX - LEVEL_MIN + 1 }, (_, i) => i + LEVEL_MIN).map((lvl) => (
                <option key={lvl} value={lvl}>
                  {LEVEL_LABELS[lvl as Level]}
                </option>
              ))}
            </select>

            <label className="mt-3 block text-sm font-medium">Evidence notes</label>
            <textarea
              className="mt-1 h-24 w-full rounded-md border border-gray-300 p-2 text-sm"
              disabled={isCalibrated}
              value={draft[d].managerNotes}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev!, [d]: { ...prev![d], managerNotes: e.target.value } }))
              }
            />
          </Card>
        );
      })}

      {!isCalibrated && (
        <Card>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
            <span>
              I confirm these agreed levels were discussed and agreed with the employee. (Required —
              the AI suggestion is never written as the final score automatically.)
            </span>
          </label>
          {calibrate.isError && (
            <div className="mt-3"><ErrorBanner message={(calibrate.error as Error).message} /></div>
          )}
          <div className="mt-4">
            <Button disabled={!confirmed || calibrate.isPending} onClick={() => calibrate.mutate()}>
              {calibrate.isPending ? 'Saving…' : 'Confirm agreed levels'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
