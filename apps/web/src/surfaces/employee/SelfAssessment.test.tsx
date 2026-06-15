import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DIMENSIONS } from '@ai-fluency/shared';
import { SelfAssessment } from './SelfAssessment.js';
import type { Me } from '../../lib/types.js';

const me: Me = {
  id: 'u1',
  email: 'test@phrase.com',
  name: 'Test User',
  role: 'EMPLOYEE',
  functionArea: 'UNASSIGNED',
  managerId: null,
  currentCycle: '2026-H1',
};

const draft = {
  id: 'a1',
  userId: 'u1',
  cycle: '2026-H1',
  status: 'DRAFT',
  openingResponse: null,
  compositeLevel: null,
  aiNarrative: null,
  scoringFailed: false,
  updatedAt: new Date().toISOString(),
  dimensionScores: DIMENSIONS.map((d, i) => ({
    id: `d${i}`,
    dimension: d,
    employeeResponse: null,
    managerNotes: null,
    aiSuggestedLevel: null,
    aiRationale: null,
    agreedLevel: null,
  })),
  calibration: null,
};

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => ({ data, error: null }),
    text: async () => JSON.stringify({ data, error: null }),
  } as unknown as Response;
}

function renderWizard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SelfAssessment me={me} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(draft)));
});
afterEach(() => vi.unstubAllGlobals());

describe('SelfAssessment wizard', () => {
  it('creates a draft on mount and shows the welcome step', async () => {
    renderWizard();
    expect(await screen.findByText('Before you start')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/v1/assessments', expect.objectContaining({ method: 'POST' }));
  });

  it('advances from welcome to the opening reflection', async () => {
    renderWizard();
    await userEvent.click(await screen.findByRole('button', { name: /Begin/ }));
    expect(
      await screen.findByText(/What’s your honest sense of where you are with AI right now/),
    ).toBeInTheDocument();
  });
});
