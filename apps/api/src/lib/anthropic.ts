import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

/**
 * Single shared Anthropic client. Used only by server-side services
 * (scoring.ts, narrative.ts) — never by route handlers or the frontend (CLAUDE.md).
 */
export const anthropic = new Anthropic({
  apiKey: config.ANTHROPIC_API_KEY,
  ...(config.ANTHROPIC_BASE_URL ? { baseURL: config.ANTHROPIC_BASE_URL } : {}),
  timeout: 30_000,
  maxRetries: 2,
  defaultHeaders: { 'anthropic-version': config.ANTHROPIC_VERSION },
});

export function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}
