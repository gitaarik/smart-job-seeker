import { describe, expect, it, vi } from "vitest";
import { isRetryableError, withRetry } from "../retry";

/** Build an Error carrying the same shape the LLM layer attaches to a 429. */
function rateLimitError(retryAfter?: number): Error {
  const err = new Error(
    "🚫 Rate limit exceeded for groq/openai/gpt-oss-120b. 429 tokens per minute",
  ) as Error & { status?: number; retryAfter?: number };
  err.status = 429;
  if (retryAfter !== undefined) err.retryAfter = retryAfter;
  return err;
}

describe("isRetryableError — rate limits", () => {
  it("retries a 429 with a short retry-after (per-minute TPM blip)", () => {
    expect(isRetryableError(rateLimitError(3))).toBe(true);
  });

  it("does NOT retry a 429 with a long retry-after (multi-minute quota)", () => {
    // 5m30s window won't clear within the attempt budget — fail fast + requeue.
    expect(isRetryableError(rateLimitError(330))).toBe(false);
  });

  it("does NOT retry a 429 with no retry-after (ambiguous window — fail fast)", () => {
    expect(isRetryableError(rateLimitError(undefined))).toBe(false);
  });

  it("does NOT retry a rate-limit message lacking a 429 status + retry-after", () => {
    // We require a concrete signal (status 429 + short retry-after), not text,
    // so an ambiguous string isn't blindly retried into an exhausted budget.
    expect(isRetryableError(new Error("429 rate limit reached"))).toBe(false);
  });
});

describe("isRetryableError — other statuses", () => {
  it("retries 5xx", () => {
    const e = new Error("upstream") as Error & { status: number };
    e.status = 503;
    expect(isRetryableError(e)).toBe(true);
  });

  it("does not retry a plain 400", () => {
    const e = new Error("bad request") as Error & { status: number };
    e.status = 400;
    expect(isRetryableError(e)).toBe(false);
  });
});

describe("isRetryableError — structured generation cut short", () => {
  /** The shape langchain.ts throws when `withStructuredOutput` parses to null. */
  const truncated = (finish: string) =>
    new Error(
      "Failed to generate JSON matching personal_agent_chat_capable: " +
        `gemini returned no usable structured output (finish reason: ${finish}, ` +
        "958 output tokens).",
    );

  it("retries a generation stopped by the output cap", () => {
    // A reasoning model's thoughts are charged against that cap and vary run to
    // run — 1,078 to 7,219 measured across nine calls on one identical prompt,
    // of which only the 7,219 failed. The retry gets a different draw.
    expect(isRetryableError(truncated("MAX_TOKENS"))).toBe(true);
  });

  it("does NOT retry output that simply would not parse", () => {
    // The line this draws: a schema the model cannot satisfy is not transient,
    // and retrying it costs three calls every time instead of one.
    expect(isRetryableError(truncated("STOP"))).toBe(false);
    expect(isRetryableError(truncated("unknown"))).toBe(false);
    expect(isRetryableError(truncated("SAFETY"))).toBe(false);
  });
});

describe("withRetry — honors provider retry-after", () => {
  it("waits the retry-after window, then succeeds on the next attempt", async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const op = vi.fn(async () => {
        calls++;
        if (calls === 1) throw rateLimitError(3); // ~3s window, then clears
        return "ok";
      });

      const promise = withRetry(op, {
        maxAttempts: 3,
        initialDelay: 1000, // would be the (wrong) fallback if retry-after ignored
        shouldRetry: isRetryableError,
      });

      // The fallback backoff would fire at ~1s; the retry-after sleep is 3s
      // (+ up to 1s jitter). Advancing 1.1s must NOT have retried yet.
      await vi.advanceTimersByTimeAsync(1100);
      expect(op).toHaveBeenCalledTimes(1);

      // Past the 3s window (+jitter), the retry fires and resolves.
      await vi.advanceTimersByTimeAsync(4000);
      await expect(promise).resolves.toBe("ok");
      expect(op).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
