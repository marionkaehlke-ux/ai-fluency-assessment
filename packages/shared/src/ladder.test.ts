import { describe, expect, it } from 'vitest';
import { compositeToLevel, computeComposite, DIMENSION_WEIGHT } from './ladder.js';

describe('compositeToLevel', () => {
  it('maps composite scores to overall levels at the §12.2 boundaries', () => {
    expect(compositeToLevel(0)).toBe(0);
    expect(compositeToLevel(0.99)).toBe(0);
    expect(compositeToLevel(1.0)).toBe(1);
    expect(compositeToLevel(1.74)).toBe(1);
    expect(compositeToLevel(1.75)).toBe(2);
    expect(compositeToLevel(2.49)).toBe(2);
    expect(compositeToLevel(2.5)).toBe(3);
    expect(compositeToLevel(3.49)).toBe(3);
    expect(compositeToLevel(3.5)).toBe(4);
    expect(compositeToLevel(4)).toBe(4);
  });
});

describe('computeComposite', () => {
  it('is the equal-weighted average of the four agreed levels', () => {
    expect(DIMENSION_WEIGHT).toBe(0.25);
    expect(computeComposite([2, 2, 2, 2])).toBe(2);
    expect(computeComposite([0, 1, 2, 3])).toBe(1.5);
    expect(computeComposite([4, 4, 4, 4])).toBe(4);
    expect(computeComposite([3, 4, 2, 4])).toBe(3.25);
  });

  it('throws when not given exactly four levels', () => {
    expect(() => computeComposite([1, 2, 3])).toThrow();
    expect(() => computeComposite([1, 2, 3, 4, 0])).toThrow();
  });
});
