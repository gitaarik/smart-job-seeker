/**
 * Retry Logic for External API Calls
 * Implements exponential backoff with jitter
 */

import { errorTracker } from "$lib/server/monitoring/error-tracker";

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Max provider-supplied retry-after (seconds) we'll wait out in-process for a
 * 429. Below this it's a per-minute TPM blip worth a short sleep; above it the
 * quota window is too long to hold the worker — fail fast and requeue.
 */
const RATE_LIMIT_RETRY_MAX_SECONDS = 30;

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  shouldRetry: () => true,
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number,
): number {
  const exponentialDelay = initialDelay * Math.pow(multiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  // Add jitter (random value between 0 and 25% of delay)
  const jitter = Math.random() * cappedDelay * 0.25;
  return cappedDelay + jitter;
}

/**
 * Pull an explicit retry-after delay (ms) off an error, if present. Providers
 * set `retryAfter` (seconds) on rate-limit errors to tell us when the quota
 * window resets (see `LLMRateLimitError`). Capped at 60s so a provider
 * returning a huge value (e.g. a daily-quota reset) doesn't hang the worker —
 * past that it's better to exhaust attempts and let the job requeue.
 */
function readRetryAfterMs(error: Error): number | undefined {
  const ra = (error as { retryAfter?: unknown }).retryAfter;
  if (typeof ra === "number" && ra > 0) {
    return Math.min(ra * 1000, 60_000);
  }
  return undefined;
}

/**
 * Retry an async operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: Error;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry this error
      if (!opts.shouldRetry(lastError)) {
        errorTracker.logWarning(
          `Non-retryable error encountered, not retrying`,
          {
            operation: "withRetry",
            metadata: { attempt, error: lastError.message },
          },
        );
        throw lastError;
      }

      // Don't retry if this was the last attempt
      if (attempt === opts.maxAttempts) {
        errorTracker.logError(
          `All retry attempts exhausted (${opts.maxAttempts})`,
          lastError,
          { operation: "withRetry" },
        );
        throw lastError;
      }

      // Calculate delay and wait before retrying. If the provider told us when
      // the quota window resets (429 retry-after), honor that — retrying on the
      // local backoff (1s/2s) just burns another attempt against a still-
      // exhausted token budget. Small jitter de-syncs parallel workers sharing
      // one org so they don't re-collide on the same window.
      const retryAfterMs = readRetryAfterMs(lastError);
      const delay = retryAfterMs !== undefined
        ? retryAfterMs + Math.random() * 1000
        : calculateDelay(
          attempt,
          opts.initialDelay,
          opts.maxDelay,
          opts.backoffMultiplier,
        );

      errorTracker.logWarning(
        `Retry attempt ${attempt}/${opts.maxAttempts} after ${
          Math.round(delay)
        }ms`,
        {
          operation: "withRetry",
          metadata: { attempt, delay, error: lastError.message },
        },
      );

      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError!;
}

/**
 * Check if error is retryable (network errors, timeouts, 5xx responses, transient LLM errors)
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Network errors
  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("econnrefused") ||
    message.includes("enotfound")
  ) {
    return true;
  }

  // HTTP 5xx errors (if error has status code). Note: the old code returned
  // `status >= 500 && status < 600` for ANY numeric status, which is false for
  // 429 — so it silently made rate-limit errors non-retryable. Only return true
  // here for genuine 5xx; 429 is handled by the rate-limit policy below.
  if ("status" in error && typeof (error as { status?: unknown }).status === "number") {
    const status = (error as { status: number }).status;
    if (status >= 500 && status < 600) return true;
  }

  // Rate-limit errors (429). Retry ONLY when the provider gave a concrete,
  // SHORT retry-after: a per-minute TPM blip (Groq returns "try again in
  // ~3s") clears on a brief sleep and the retry succeeds. We require an
  // explicit short window because:
  //   - a long one (5-minute / hourly / daily quota) won't clear within our
  //     attempt budget — retrying just holds the worker, so fail fast + requeue;
  //   - an UNKNOWN window (no parseable time) is ambiguous — retrying blindly
  //     can hammer a still-exhausted budget, so we surface the error instead.
  // LLMRateLimitError carries `status = 429` and a parsed `retryAfter` (seconds).
  if ("status" in error && (error as { status?: unknown }).status === 429) {
    const retryAfter = (error as { retryAfter?: unknown }).retryAfter;
    return typeof retryAfter === "number" &&
      retryAfter <= RATE_LIMIT_RETRY_MAX_SECONDS;
  }

  // Groq JSON generation failures (transient - can succeed on retry)
  // Error format: 400 {"error":{"code":"json_validate_failed",...}}
  if (message.includes("json_validate_failed")) {
    return true;
  }

  return false;
}
