import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DIMENSIONS,
  LEVEL_LABELS,
  OPENING_MIN_CHARS,
  RESPONSE_MIN_CHARS,
  type Dimension,
  type Level,
} from '@ai-fluency/shared';
import { api } from '../../lib/api.js';
import { Button, Card, ErrorBanner, Spinner } from '../../components/ui.js';
import type { Assessment, Me } from '../../lib/types.js';

const QUESTIONS: Record<Dimension, string> = {
  MINDSET:
    'How does AI fit your typical week? Tell me about a moment AI changed how you thought about a problem.',
  STRATEGY:
    'How do you approach a new task when AI could help? Has your team changed how it works because of AI — what was your role?',
  BUILDING:
    'Tell me about something you\'ve built with AI. When something doesn\'t work, what do you do?',
  ACCOUNTABILITY:
    'How do you know if your AI use is working? Think of someone whose AI use has changed — what happened?',
};

type Responses = Record<Dimension, string>;

function formatPeriodLabel(period: string | null): string | null {
  if (!period) return null;
  if (period === 'last-1-month') return 'Last month';
  if (period === 'last-2-months') return 'Last 2 months';
  if (period === 'last-3-months') return 'Last 3 months';
  if (period.startsWith('custom:')) {
    const [, start, end] = period.split(':');
    return `${start} – ${end}`;
  }
  return null;
}

export function SelfAssessment({ me }: { me: Me }) {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const periodLabel = formatPeriodLabel(searchParams.get('period'));
  const [step, setStep] = useState(0);
  const [opening, setOpening] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [responses, setResponses] = useState<Responses>({
    MINDSET: '',
    STRATEGY: '',
    BUILDING: '',
    ACCOUNTABILITY: '',
  });

  // Create or fetch the draft for the current cycle.
  const draft = useQuery({
    queryKey: ['assessment', 'draft', me.currentCycle],
    queryFn: () => api.post<Assessment>('/assessments', { cycle: me.currentCycle }),
  });
  const assessment = draft.data;

  // Hydrate local state from a previously saved draft.
  useEffect(() => {
    if (!assessment) return;
    setOpening((o) => o || assessment.openingResponse || '');
    setResponses((r) => {
      const next = { ...r };
      for (const ds of assessment.dimensionScores) {
        if (!next[ds.dimension] && ds.employeeResponse) next[ds.dimension] = ds.employeeResponse;
      }
      return next;
    });
    if (assessment.status !== 'DRAFT') setStep(4);
  }, [assessment]);

  const submit = useMutation({
    mutationFn: () =>
      api.post<Assessment>(`/assessments/${assessment!.id}/submit`, {
        expectedUpdatedAt: assessment!.updatedAt,
        openingResponse: opening.trim(),
        responses: DIMENSIONS.map((d) => ({ dimension: d, employeeResponse: responses[d].trim() })),
      }),
    onSuccess: (data) => {
      qc.setQueryData(['assessment', 'draft', me.currentCycle], data);
      setStep(4);
    },
  });

  if (draft.isLoading) return <Spinner />;
  if (draft.isError || !assessment)
    return <ErrorBanner message={(draft.error as Error)?.message ?? 'Could not load your assessment.'} />;

  const openingOk = opening.trim().length >= OPENING_MIN_CHARS;
  const allResponsesOk = DIMENSIONS.every((d) => responses[d].trim().length >= RESPONSE_MIN_CHARS);

  return (
    <div className="space-y-6">
      <StepHeader step={step} />
      {periodLabel && (
        <p className="text-xs text-gray-500">
          Assessment period: <span className="font-medium text-gray-700">{periodLabel}</span>
        </p>
      )}

      {step === 0 && (
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Before you start</h2>
          <p className="text-sm text-gray-600">
            This takes about 15–20 minutes. There are four open questions — one per dimension of the
            AI Fluency Ladder. Answer honestly; the AI suggestion you get is a starting point for a
            conversation with your manager, never a final score.
          </p>
          <div className="mt-4">
            <Button onClick={() => setStep(1)}>Begin →</Button>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <p className="mb-4 text-sm text-gray-500">
            The AI Fluency Ladder describes five levels of AI adoption — from not using AI at all
            (L0) to actively multiplying others’ capabilities with it (L4). This opening reflection
            helps you warm up before the four scored questions. There are no right or wrong answers.
          </p>
          <label className="mb-1 block font-medium">
            What’s your honest sense of where you are with AI right now?
          </label>
          <p className="mb-2 text-xs text-gray-400">
            Think about: which AI tools you use, how often, and what you actually do with them.
            Where are you a confident power-user? When did AI last genuinely change how you worked?
            Where do you still avoid it or feel uncertain? Attach your self assessment report if you
            have completed one (voluntary).
          </p>
          <textarea
            className="h-40 w-full rounded-md border border-gray-300 p-3 text-sm"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            placeholder="A few sentences…"
          />
          <CharCount value={opening} min={OPENING_MIN_CHARS} />

          <div
            className={`mt-4 rounded-md border-2 border-dashed p-4 text-center text-sm transition-colors ${dragging ? 'border-brand bg-blue-50' : 'border-gray-300 bg-gray-50'}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) setReportFile(file);
            }}
          >
            {reportFile ? (
              <div className="flex items-center justify-center gap-2 text-gray-700">
                <span>📎 {reportFile.name}</span>
                <button
                  type="button"
                  className="text-xs text-gray-400 hover:text-red-500"
                  onClick={() => setReportFile(null)}
                >
                  ✕ Remove
                </button>
              </div>
            ) : (
              <>
                <p className="text-gray-500">
                  Drag & drop your self assessment report here, or{' '}
                  <button
                    type="button"
                    className="text-brand underline hover:opacity-80"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    browse to attach
                  </button>
                </p>
                <p className="mt-1 text-xs text-gray-400">PDF, DOCX, or similar (voluntary)</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setReportFile(file);
              }}
            />
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={() => setStep(0)}>← Back</Button>
            <Button disabled={!openingOk} onClick={() => setStep(2)}>Next →</Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {DIMENSIONS.map((d) => (
            <Card key={d}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand">{d}</p>
              <label className="mb-2 block text-sm font-medium">{QUESTIONS[d]}</label>
              <textarea
                className="h-32 w-full rounded-md border border-gray-300 p-3 text-sm"
                value={responses[d]}
                onChange={(e) => setResponses((r) => ({ ...r, [d]: e.target.value }))}
              />
              <CharCount value={responses[d]} min={RESPONSE_MIN_CHARS} />
            </Card>
          ))}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
            <Button disabled={!allResponsesOk} onClick={() => setStep(3)}>Review →</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Ready to submit</h2>
          <p className="text-sm text-gray-600">
            On submit, your answers are scored by Claude. You’ll see a suggested level per dimension
            with a short rationale. You can’t edit the AI scores — you’ll review them with your
            manager.
          </p>
          {submit.isError && (
            <div className="mt-3">
              <ErrorBanner message={(submit.error as Error).message} />
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={() => setStep(2)}>← Back</Button>
            <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
              {submit.isPending ? 'Submitting…' : 'Submit for scoring'}
            </Button>
          </div>
        </Card>
      )}

      {step === 4 && <ResultView assessmentId={assessment.id} cycle={me.currentCycle} />}
    </div>
  );
}

function StepHeader({ step }: { step: number }) {
  const labels = ['Welcome', 'Opening reflection', 'Four-theme interview', 'Review', 'Your result'];
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {labels.map((l, i) => (
        <span
          key={l}
          className={`rounded-full px-3 py-1 ${i === step ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500'}`}
        >
          {i + 1}. {l}
        </span>
      ))}
    </div>
  );
}

function CharCount({ value, min }: { value: string; min: number }) {
  const n = value.trim().length;
  const met = n >= min;
  return (
    <p className={`mt-1 text-xs font-medium ${met ? 'text-green-600' : 'text-orange-500'}`}>
      {met ? `✓ ${n} / ${min} characters` : `${n} / ${min} characters required to continue`}
    </p>
  );
}

/** Polls the assessment until AI suggestions appear (scoring runs synchronously now). */
function ResultView({ assessmentId, cycle }: { assessmentId: string; cycle: string }) {
  const [timedOut, setTimedOut] = useState(false);
  const q = useQuery({
    queryKey: ['assessment', assessmentId],
    queryFn: () => api.get<Assessment>(`/assessments/${assessmentId}`),
    refetchInterval: (query) => {
      const a = query.state.data;
      const scored = a?.dimensionScores.every((d) => d.aiSuggestedLevel != null);
      return scored || a?.scoringFailed ? false : 2000;
    },
  });

  useEffect(() => {
    const a = q.data;
    const scored = a?.dimensionScores.every((d) => d.aiSuggestedLevel != null);
    if (scored || a?.scoringFailed) return;
    const t = setTimeout(() => setTimedOut(true), 30_000);
    return () => clearTimeout(t);
  }, [q.data]);

  const retry = useMutation({
    mutationFn: () => api.post(`/assessments/${assessmentId}/score`),
    onSuccess: () => q.refetch(),
  });

  void cycle;
  if (q.isLoading || !q.data) return <Spinner />;
  const a = q.data;
  const scored = a.dimensionScores.every((d) => d.aiSuggestedLevel != null);

  if (a.scoringFailed && !scored) {
    return (
      <Card>
        <ErrorBanner message="We couldn’t score your responses right now. Your answers are saved — try again in a few minutes, or ask your manager to start the conversation." />
        <div className="mt-4">
          <Button disabled={retry.isPending} onClick={() => retry.mutate()}>
            {retry.isPending ? 'Retrying…' : 'Try again'}
          </Button>
        </div>
      </Card>
    );
  }

  if (!scored) {
    return (
      <Card>
        <p className="text-sm text-gray-600">Scoring your responses… this usually takes a few seconds.</p>
        {timedOut ? (
          <div className="mt-4">
            <p className="mb-3 text-sm text-gray-500">This is taking longer than expected.</p>
            <Button disabled={retry.isPending} onClick={() => { setTimedOut(false); retry.mutate(); }}>
              {retry.isPending ? 'Retrying…' : 'Try again'}
            </Button>
          </div>
        ) : (
          <div className="mt-3"><Spinner /></div>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">Your AI-suggested levels</h2>
      <p className="mb-4 text-xs font-medium text-amber-700">
        AI suggestion — review with your manager. These are not final.
      </p>
      <ul className="space-y-3">
        {a.dimensionScores.map((d) => (
          <li key={d.id} className="border-b border-gray-100 pb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-brand">
                {d.dimension}
              </span>
              <span className="font-semibold">
                {d.aiSuggestedLevel != null ? LEVEL_LABELS[d.aiSuggestedLevel as Level] : '—'}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">{d.aiRationale}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-gray-600">
        Next: your manager will review these with you in a 1:1 and you’ll agree on a final level
        together.
      </p>
    </Card>
  );
}
