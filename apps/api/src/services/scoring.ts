import { scoringSchema, type ScoringResult } from '@ai-fluency/shared';
import { config } from '../config.js';
import { anthropic, extractText } from '../lib/anthropic.js';
import { CircuitBreaker } from '../lib/circuit-breaker.js';
import { loadScoringPrompt } from '../lib/prompt.js';

/**
 * The ONLY module that talks to the Claude API (CLAUDE.md). Never call Anthropic
 * from route handlers or the frontend. Model string, version, prompt version and
 * generation params are all resolved from config — never hard-coded (spec §7.4).
 */

export interface ScoringInput {
  openingResponse: string;
  mindset: string;
  strategy: string;
  building: string;
  accountability: string;
}

export interface ScoringOutput {
  result: ScoringResult;
  model: string;
  promptVersion: string;
}

const breaker = new CircuitBreaker();

export class ScoringFailedError extends Error {
  constructor(
    message: string,
    readonly failureCause: 'breaker_open' | 'api_error' | 'invalid_output',
    readonly raw?: string,
  ) {
    super(message);
    this.name = 'ScoringFailedError';
  }
}

/** Employee free-text goes in the USER message only — never the system message (spec §8.4). */
function buildUserMessage(input: ScoringInput): string {
  return [
    'Score the following employee responses. Return ONLY the JSON object described in your instructions.',
    '',
    `OPENING REFLECTION:\n${input.openingResponse}`,
    '',
    `MINDSET RESPONSE:\n${input.mindset}`,
    '',
    `STRATEGY RESPONSE:\n${input.strategy}`,
    '',
    `BUILDING RESPONSE:\n${input.building}`,
    '',
    `ACCOUNTABILITY RESPONSE:\n${input.accountability}`,
  ].join('\n');
}

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: config.CLAUDE_MODEL,
    max_tokens: 512,
    temperature: 0,
    top_p: 1,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
  return extractText(message);
}

function parseAndValidate(raw: string): ScoringResult {
  // Tolerate code fences or stray prose around the JSON object.
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  const json: unknown = JSON.parse(slice);
  return scoringSchema.parse(json); // throws on out-of-range level / missing dimension
}

/**
 * Score one assessment. Validates Claude's output against scoringSchema before
 * returning; on invalid output, retries the call once (transient model glitch),
 * then throws (spec §7a.2). Throws when the breaker is open (spec §7.4).
 * The caller (queue worker) is responsible for persisting, never this function.
 */
export async function scoreAssessment(input: ScoringInput): Promise<ScoringOutput> {
  if (breaker.isOpen()) {
    throw new ScoringFailedError('Scoring circuit breaker is open.', 'breaker_open');
  }

  const { version, text } = loadScoringPrompt();
  const userMessage = buildUserMessage(input);

  let lastRaw = '';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let raw: string;
    try {
      raw = await callClaude(text, userMessage);
    } catch (err) {
      // Network/timeout/5xx after the SDK's own retries.
      breaker.recordFailure();
      throw new ScoringFailedError(`Anthropic API error: ${(err as Error).message}`, 'api_error');
    }
    lastRaw = raw;
    try {
      const result = parseAndValidate(raw);
      breaker.recordSuccess();
      return { result, model: config.CLAUDE_MODEL, promptVersion: version };
    } catch {
      // Invalid/malformed output — retry once with the same prompt (spec §7a.2).
      if (attempt === 2) break;
    }
  }

  breaker.recordFailure();
  throw new ScoringFailedError('Claude output failed schema validation.', 'invalid_output', lastRaw);
}
