import { afterEach, describe, expect, it, vi } from 'vitest';

const INPUT = {
  openingResponse: 'opening',
  mindset: 'm',
  strategy: 's',
  building: 'b',
  accountability: 'a',
};

const validJson = JSON.stringify({
  mindset: { level: 2, rationale: 'r' },
  strategy: { level: 3, rationale: 'r' },
  building: { level: 1, rationale: 'r' },
  accountability: { level: 0, rationale: 'r' },
});

/** Load a fresh scoring module (module-level circuit breaker is per-import) with mocks. */
async function loadScoring(create: (...args: unknown[]) => unknown) {
  vi.resetModules();
  vi.doMock('../src/lib/anthropic.js', () => ({
    anthropic: { messages: { create } },
    extractText: (m: { text?: string }) => m.text ?? '',
  }));
  vi.doMock('../src/lib/prompt.js', () => ({
    loadScoringPrompt: () => ({ version: 'v1', text: 'RUBRIC' }),
  }));
  return import('../src/services/scoring.js');
}

afterEach(() => vi.resetAllMocks());

describe('scoreAssessment', () => {
  it('returns a validated result with the configured model and prompt version (happy path)', async () => {
    const create = vi.fn().mockResolvedValue({ text: validJson });
    const { scoreAssessment } = await loadScoring(create);

    const out = await scoreAssessment(INPUT);
    expect(out.result.mindset.level).toBe(2);
    expect(out.result.accountability.level).toBe(0);
    expect(out.model).toBe('claude-sonnet-4-5');
    expect(out.promptVersion).toBe('v1');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('retries once on malformed output and succeeds on the second attempt', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ text: 'not json at all' })
      .mockResolvedValueOnce({ text: validJson });
    const { scoreAssessment } = await loadScoring(create);

    const out = await scoreAssessment(INPUT);
    expect(out.result.strategy.level).toBe(3);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('throws invalid_output when output stays malformed after the retry', async () => {
    const create = vi.fn().mockResolvedValue({ text: 'still not json' });
    const { scoreAssessment, ScoringFailedError } = await loadScoring(create);

    const err = await scoreAssessment(INPUT).catch((e) => e);
    expect(err).toBeInstanceOf(ScoringFailedError);
    expect(err.failureCause).toBe('invalid_output');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('rejects an out-of-range level (5) via the Zod gate', async () => {
    const badLevel = JSON.stringify({
      mindset: { level: 5, rationale: 'r' },
      strategy: { level: 3, rationale: 'r' },
      building: { level: 1, rationale: 'r' },
      accountability: { level: 0, rationale: 'r' },
    });
    const { scoreAssessment } = await loadScoring(vi.fn().mockResolvedValue({ text: badLevel }));
    const err = await scoreAssessment(INPUT).catch((e) => e);
    expect(err.failureCause).toBe('invalid_output');
  });

  it('rejects output missing a dimension', async () => {
    const missing = JSON.stringify({
      mindset: { level: 2, rationale: 'r' },
      strategy: { level: 3, rationale: 'r' },
      accountability: { level: 0, rationale: 'r' },
    });
    const { scoreAssessment } = await loadScoring(vi.fn().mockResolvedValue({ text: missing }));
    const err = await scoreAssessment(INPUT).catch((e) => e);
    expect(err.failureCause).toBe('invalid_output');
  });

  it('throws api_error when the Anthropic call fails', async () => {
    const create = vi.fn().mockRejectedValue(new Error('network down'));
    const { scoreAssessment } = await loadScoring(create);

    const err = await scoreAssessment(INPUT).catch((e) => e);
    expect(err.failureCause).toBe('api_error');
    expect(create).toHaveBeenCalledTimes(1); // no retry on transport error in this layer
  });

  it('opens the circuit breaker after repeated failures and short-circuits subsequent calls', async () => {
    const create = vi.fn().mockRejectedValue(new Error('down'));
    const { scoreAssessment } = await loadScoring(create);

    // Five consecutive failures trip the breaker (threshold = 5).
    for (let i = 0; i < 5; i += 1) {
      const err = await scoreAssessment(INPUT).catch((e) => e);
      expect(err.failureCause).toBe('api_error');
    }
    const sixth = await scoreAssessment(INPUT).catch((e) => e);
    expect(sixth.failureCause).toBe('breaker_open');
    expect(create).toHaveBeenCalledTimes(5); // 6th call never reached the API
  });
});
