import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from '../config.js';

/**
 * Loads the scoring rubric system prompt from prompts/scoring-rubric-v{n}.txt
 * (spec §7.4). The rubric is the system message and is never sent in the user
 * message. Cached after first read; the version is pinned by SCORING_PROMPT_VERSION.
 */
let cached: { version: string; text: string } | null = null;

export function loadScoringPrompt(): { version: string; text: string } {
  if (cached && cached.version === config.SCORING_PROMPT_VERSION) return cached;

  const filename = `scoring-rubric-${config.SCORING_PROMPT_VERSION}.txt`;
  const candidates = [
    resolve(process.cwd(), 'prompts', filename),
    resolve(process.cwd(), '..', '..', 'prompts', filename),
  ];

  for (const path of candidates) {
    try {
      const text = readFileSync(path, 'utf8');
      cached = { version: config.SCORING_PROMPT_VERSION, text };
      return cached;
    } catch {
      // try next candidate
    }
  }
  throw new Error(`Scoring prompt not found: ${filename} (looked in ${candidates.join(', ')})`);
}
