/**
 * The key-based path, which is what every /api/ai write now goes through.
 *
 * The Request-derived key was the only one available before, and it falls back
 * to client IP — so a shared NAT shared a bucket and one user on two networks
 * got two. Behind an auth gate the caller already knows who is asking, and
 * these tests pin that the buckets are per-key and independent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiRateLimiter } from "../rate-limit";

describe("aiRateLimiter", () => {
  beforeEach(() => {
    aiRateLimiter.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    aiRateLimiter.reset();
  });

  it("allows a burst up to the bucket size", () => {
    for (let i = 0; i < 15; i++) {
      expect(aiRateLimiter.tryConsumeKey("user-1"), `call ${i + 1}`).toBe(true);
    }
  });

  it("refuses once the burst is spent", () => {
    for (let i = 0; i < 15; i++) aiRateLimiter.tryConsumeKey("user-1");
    expect(aiRateLimiter.tryConsumeKey("user-1")).toBe(false);
  });

  it("keeps one user's spend off another's bucket", () => {
    // The whole point of keying on the user: a heavy user must not lock out
    // everyone sharing their egress IP.
    for (let i = 0; i < 15; i++) aiRateLimiter.tryConsumeKey("user-1");
    expect(aiRateLimiter.tryConsumeKey("user-1")).toBe(false);
    expect(aiRateLimiter.tryConsumeKey("user-2")).toBe(true);
  });

  it("refills over time rather than resetting on a window boundary", () => {
    for (let i = 0; i < 15; i++) aiRateLimiter.tryConsumeKey("user-1");
    expect(aiRateLimiter.tryConsumeKey("user-1")).toBe(false);

    // 0.2 tokens/second, so five seconds buys exactly one more call.
    vi.advanceTimersByTime(5000);
    expect(aiRateLimiter.tryConsumeKey("user-1")).toBe(true);
    expect(aiRateLimiter.tryConsumeKey("user-1")).toBe(false);
  });

  it("never refills past the burst ceiling", () => {
    aiRateLimiter.tryConsumeKey("user-1");
    vi.advanceTimersByTime(60 * 60 * 1000);

    for (let i = 0; i < 15; i++) {
      expect(aiRateLimiter.tryConsumeKey("user-1"), `call ${i + 1}`).toBe(true);
    }
    expect(aiRateLimiter.tryConsumeKey("user-1")).toBe(false);
  });

  it("reports a retry-after matching the refill rate", () => {
    // 60 (the createRateLimitResponse default) would tell a user to wait a
    // minute for a token that arrives in five seconds.
    expect(aiRateLimiter.retryAfterSeconds()).toBe(5);
  });
});
