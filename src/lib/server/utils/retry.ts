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

      // Calculate delay and wait before retrying
      const delay = calculateDelay(
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
 * Check if error is retryable (network errors, timeouts, 5xx responses)
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

  // HTTP 5xx errors (if error has status code)
  if ("status" in error && typeof error.status === "number") {
    return error.status >= 500 && error.status < 600;
  }

  // Rate limit errors (429)
  if ("status" in error && error.status === 429) {
    return true;
  }

  return false;
}
