import { useEffect, useId, useRef, useState } from 'react';
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
  const [dimensionFiles, setDimensionFiles] = useState<Record<Dimension, File[]>>({
    MINDSET: [], STRATEGY: [], BUILDING: [], ACCOUNTABILITY: [],
  });
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
            (L0) to actively multiplying others' capabilities with it (L4). This opening reflection
            helps you warm up before the four scored questions. There are no right or wrong answers.
          </p>
          <label className="mb-1 block font-medium">
            What's your honest sense of where you are with AI right now?
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

          <FileAttach
            files={reportFile ? [reportFile] : []}
            onChange={(fs) => setReportFile(fs[fs.length - 1] ?? null)}
          />

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
              <label className="mb-1 block text-sm font-medium">{QUESTIONS[d]}</label>
              <p className="mb-2 text-xs text-gray-500">Please add any evidence if available.</p>
              <textarea
                className="h-32 w-full rounded-md border border-gray-300 p-3 text-sm"
                value={responses[d]}
                onChange={(e) => setResponses((r) => ({ ...r, [d]: e.target.value }))}
              />
              <CharCount value={responses[d]} min={RESPONSE_MIN_CHARS} />
              <FileAttach
                files={dimensionFiles[d]}
                onChange={(fs) => setDimensionFiles((prev) => ({ ...prev, [d]: fs }))}
              />
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
            On submit, your answers are scored by Claude. You'll see a suggested level per dimension
            with a short rationale. You can't edit the AI scores — you'll review them with your
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

function FileAttach({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    onChange([...files, ...Array.from(incoming)]);
  }

  function remove(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="mt-3 space-y-2">
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700">
              <span className="flex-1 truncate">📎 {f.name}</span>
              <button type="button" className="text-xs text-gray-400 hover:text-red-500" onClick={() => remove(i)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div
        className={`rounded-md border-2 border-dashed p-3 text-center text-sm transition-colors ${dragging ? 'border-brand bg-blue-50' : 'border-gray-200 bg-gray-50'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <p className="text-gray-500">
          Drag & drop files here, or{' '}
          <label htmlFor={inputId} className="cursor-pointer text-brand underline hover:opacity-80">
            browse to attach
          </label>
        </p>
        <p className="mt-1 text-xs text-gray-400">PDF, DOCX, image, or screenshot — add as many as needed</p>
      </div>
      <input
        id={inputId}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
      />
    </div>
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
        <ErrorBanner message="We couldn't score your responses right now. Your answers are saved — try again in a few minutes, or ask your manager to start the conversation." />
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

  const composite = a.compositeLevel;
  const scored4 = a.dimensionScores.filter((d) => d.aiSuggestedLevel != null);
  const avgSuggested =
    scored4.length > 0
      ? scored4.reduce((s, d) => s + (d.aiSuggestedLevel ?? 0), 0) / scored4.length
      : null;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Your AI Fluency Report</h2>
            <p className="mt-0.5 text-xs font-medium text-amber-700">
              AI suggestion — review with your manager. These are not final.
            </p>
          </div>
          {avgSuggested != null && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Overall (suggested)</p>
              <p className="text-2xl font-bold text-brand">
                {LEVEL_LABELS[Math.round(avgSuggested) as Level]}
              </p>
              {composite != null && (
                <p className="text-xs text-gray-500">
                  Agreed: {LEVEL_LABELS[Math.round(composite) as Level]}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {a.dimensionScores.map((d) => {
        const tips = d.aiDevelopmentTips;
        const nextLevel = d.aiSuggestedLevel != null && d.aiSuggestedLevel < 4
          ? LEVEL_LABELS[(d.aiSuggestedLevel + 1) as Level]
          : null;
        return (
          <Card key={d.id}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-brand">
                {d.dimension}
              </span>
              <span className="rounded-full bg-brand/10 px-3 py-0.5 text-sm font-semibold text-brand">
                {d.aiSuggestedLevel != null ? LEVEL_LABELS[d.aiSuggestedLevel as Level] : '—'}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-700">{d.aiRationale}</p>
            {tips && tips.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-gray-500">
                  To reach {nextLevel ?? 'deeper impact at L4'}:
                </p>
                <ul className="mt-1 space-y-1">
                  {tips.map((tip, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-600">
                      <span className="mt-0.5 text-brand">→</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        );
      })}

      <Card>
        <p className="text-sm text-gray-600">
          Next: your manager will review these with you in a 1:1 and confirm your final agreed levels.
        </p>
      </Card>
    </div>
  );
}
