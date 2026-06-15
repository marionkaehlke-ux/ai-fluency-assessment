import { describe, expect, it } from 'vitest';
import { CircuitBreaker } from '../src/lib/circuit-breaker.js';

describe('CircuitBreaker', () => {
  it('starts closed', () => {
    expect(new CircuitBreaker().isOpen()).toBe(false);
  });

  it('opens after the failure threshold within the window', () => {
    const b = new CircuitBreaker(5, 60_000, 2, 30_000);
    const t = 1_000;
    for (let i = 0; i < 4; i += 1) b.recordFailure(t + i);
    expect(b.isOpen(t + 4)).toBe(false); // 4 failures — still closed
    b.recordFailure(t + 4); // 5th failure opens it
    expect(b.isOpen(t + 5)).toBe(true);
  });

  it('half-opens after the cooldown elapses', () => {
    const b = new CircuitBreaker(5, 60_000, 2, 30_000);
    for (let i = 0; i < 5; i += 1) b.recordFailure(1_000 + i);
    expect(b.isOpen(1_005)).toBe(true);
    expect(b.isOpen(1_005 + 30_000)).toBe(false); // cooldown passed → trial allowed
  });

  it('closes only after the success threshold of consecutive successes', () => {
    const b = new CircuitBreaker(5, 60_000, 2, 30_000);
    for (let i = 0; i < 5; i += 1) b.recordFailure(1_000 + i);
    b.recordSuccess(); // 1 success — not enough to close
    expect(b.isOpen(1_010)).toBe(true);
    b.recordSuccess(); // 2nd success closes it
    expect(b.isOpen(1_010)).toBe(false);
  });

  it('does not accumulate failures spread beyond the window', () => {
    const b = new CircuitBreaker(5, 60_000, 2, 30_000);
    b.recordFailure(0);
    b.recordFailure(70_000); // outside the 60s window → counter resets
    b.recordFailure(140_000);
    expect(b.isOpen(140_001)).toBe(false);
  });
});
