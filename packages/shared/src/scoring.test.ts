import { describe, expect, it } from 'vitest';
import {
  dimensionResponseSchema,
  openingResponseSchema,
  RESPONSE_MIN_CHARS,
  scoringSchema,
} from './scoring.js';

const valid = {
  mindset: { level: 2, rationale: 'ok' },
  strategy: { level: 3, rationale: 'ok' },
  building: { level: 1, rationale: 'ok' },
  accountability: { level: 0, rationale: 'ok' },
};

describe('scoringSchema', () => {
  it('accepts a well-formed result', () => {
    expect(scoringSchema.parse(valid)).toEqual(valid);
  });

  it('rejects an out-of-range level (e.g. 5)', () => {
    expect(() => scoringSchema.parse({ ...valid, mindset: { level: 5, rationale: 'x' } })).toThrow();
  });

  it('rejects a negative level', () => {
    expect(() => scoringSchema.parse({ ...valid, building: { level: -1, rationale: 'x' } })).toThrow();
  });

  it('rejects a non-integer level', () => {
    expect(() => scoringSchema.parse({ ...valid, strategy: { level: 2.5, rationale: 'x' } })).toThrow();
  });

  it('rejects a missing dimension', () => {
    const { building, ...missing } = valid;
    void building;
    expect(() => scoringSchema.parse(missing)).toThrow();
  });

  it('rejects an empty rationale', () => {
    expect(() => scoringSchema.parse({ ...valid, mindset: { level: 2, rationale: '' } })).toThrow();
  });
});

describe('response length schemas', () => {
  it('enforces the minimum dimension response length', () => {
    expect(() => dimensionResponseSchema.parse('too short')).toThrow();
    expect(dimensionResponseSchema.parse('x'.repeat(RESPONSE_MIN_CHARS))).toHaveLength(RESPONSE_MIN_CHARS);
  });

  it('enforces the minimum opening reflection length', () => {
    expect(() => openingResponseSchema.parse('x'.repeat(50))).toThrow();
    expect(openingResponseSchema.parse('x'.repeat(120))).toHaveLength(120);
  });
});
