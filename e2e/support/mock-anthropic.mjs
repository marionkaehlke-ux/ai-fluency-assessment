// Minimal mock of the Anthropic Messages API for deterministic, offline E2E scoring.
// The real SDK posts to {baseURL}/v1/messages. We return a fixed, schema-valid score —
// unless the request contains the FAILMODE sentinel, in which case we return malformed
// output so the scoring service marks the assessment scoring_failed (path 4).
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_ANTHROPIC_PORT ?? 8787);
const FAILMODE = 'FAILMODE';

const validScores = JSON.stringify({
  mindset: { level: 2, rationale: 'Iterates on prompts independently.' },
  strategy: { level: 2, rationale: 'Applies AI to well-scoped tasks.' },
  building: { level: 1, rationale: 'Uses pre-built tools with defaults.' },
  accountability: { level: 2, rationale: 'Has a consistent review practice.' },
});

function reply(res, text) {
  const body = JSON.stringify({
    id: 'msg_mock',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-5',
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 10 },
    content: [{ type: 'text', text }],
  });
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(body);
}

createServer((req, res) => {
  if (!req.url?.endsWith('/v1/messages')) {
    res.writeHead(404);
    res.end();
    return;
  }
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const failing = raw.includes(FAILMODE);
    reply(res, failing ? 'this is not valid json' : validScores);
  });
}).listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[mock-anthropic] listening on :${PORT}`);
});
