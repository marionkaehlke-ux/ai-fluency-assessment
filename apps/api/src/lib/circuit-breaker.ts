/**
 * Simple in-memory circuit breaker for the Claude scoring call (spec §7.4).
 * Opens after `failureThreshold` consecutive failures within `windowMs`; closes
 * after `successThreshold` consecutive successes. Per-process (per pod) — adequate
 * for the MVP; a shared/distributed breaker is a Phase 2 consideration.
 */
export class CircuitBreaker {
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private openedAt: number | null = null;
  private firstFailureAt: number | null = null;

  constructor(
    private readonly failureThreshold = 5,
    private readonly windowMs = 5 * 60 * 1000,
    private readonly successThreshold = 2,
    private readonly cooldownMs = 60 * 1000,
  ) {}

  /** True when calls should be short-circuited (breaker open and still cooling down). */
  isOpen(now: number = Date.now()): boolean {
    if (this.openedAt === null) return false;
    if (now - this.openedAt >= this.cooldownMs) {
      // Allow a trial call (half-open) after cooldown.
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.firstFailureAt = null;
    this.consecutiveSuccesses += 1;
    if (this.consecutiveSuccesses >= this.successThreshold) {
      this.openedAt = null;
    }
  }

  recordFailure(now: number = Date.now()): void {
    this.consecutiveSuccesses = 0;
    if (this.firstFailureAt === null || now - this.firstFailureAt > this.windowMs) {
      this.firstFailureAt = now;
      this.consecutiveFailures = 1;
    } else {
      this.consecutiveFailures += 1;
    }
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.openedAt = now;
    }
  }
}
