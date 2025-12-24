/**
 * Rate Limiting Middleware
 * Token bucket algorithm for API rate limiting
 */

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitOptions {
  maxTokens?: number;
  refillRate?: number; // tokens per second
  identifier?: (request: Request) => string;
}

class RateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private maxTokens: number;
  private refillRate: number;
  private identifier: (request: Request) => string;

  constructor(options: RateLimitOptions = {}) {
    this.maxTokens = options.maxTokens || 10;
    this.refillRate = options.refillRate || 1; // 1 token per second
    this.identifier = options.identifier ||
      ((req) => this.getClientIP(req) || "unknown");
  }

  /**
   * Extract client IP from request
   */
  private getClientIP(request: Request): string | null {
    // Check common headers for client IP
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
      return forwardedFor.split(",")[0].trim();
    }

    const realIP = request.headers.get("x-real-ip");
    if (realIP) {
      return realIP;
    }

    return null;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsedSeconds * this.refillRate;

    bucket.tokens = Math.min(
      this.maxTokens,
      bucket.tokens + tokensToAdd,
    );
    bucket.lastRefill = now;
  }

  /**
   * Try to consume a token from the bucket
   */
  tryConsume(request: Request, tokens: number = 1): boolean {
    const key = this.identifier(request);
    let bucket = this.buckets.get(key);

    // Create bucket if it doesn't exist
    if (!bucket) {
      bucket = {
        tokens: this.maxTokens,
        lastRefill: Date.now(),
      };
      this.buckets.set(key, bucket);
    }

    // Refill tokens
    this.refillTokens(bucket);

    // Try to consume tokens
    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Get current bucket status for debugging
   */
  getBucketStatus(request: Request): {
    tokens: number;
    maxTokens: number;
  } | null {
    const key = this.identifier(request);
    const bucket = this.buckets.get(key);

    if (!bucket) {
      return null;
    }

    this.refillTokens(bucket);
    return {
      tokens: bucket.tokens,
      maxTokens: this.maxTokens,
    };
  }

  /**
   * Clean up old buckets
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 1000 * 60 * 60; // 1 hour

    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAge) {
        this.buckets.delete(key);
      }
    }
  }

  /**
   * Reset all buckets (useful for testing)
   */
  reset(): void {
    this.buckets.clear();
  }
}

// Create rate limiter instances for different endpoints
export const webhookRateLimiter = new RateLimiter({
  maxTokens: 20, // 20 requests
  refillRate: 0.5, // 1 request every 2 seconds
});

export const apiRateLimiter = new RateLimiter({
  maxTokens: 60, // 60 requests
  refillRate: 1, // 1 request per second
});

// Cleanup old buckets every 30 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    webhookRateLimiter.cleanup();
    apiRateLimiter.cleanup();
  }, 1000 * 60 * 30);
}

/**
 * Create a rate limit response
 */
export function createRateLimitResponse(
  retryAfter: number = 60,
): Response {
  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      message: "Too many requests. Please try again later.",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    },
  );
}
