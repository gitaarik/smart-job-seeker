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

/**
 * Sweep idle buckets once the map passes this many keys.
 *
 * `cleanup()` has always existed and nothing has ever called it, which is
 * harmless for a limiter keyed on user id (bounded by the user count) and a
 * slow leak for one keyed on client IP (unbounded). Sweeping opportunistically
 * from the consume path keeps that bounded without a global timer, which in a
 * SvelteKit server would outlive the request that started it.
 */
const SWEEP_THRESHOLD = 5000;

class RateLimiter {
	private buckets = new Map<string, TokenBucket>();
	private maxTokens: number;
	private refillRate: number;
	private identifier: (request: Request) => string;

	constructor(options: RateLimitOptions = {}) {
		this.maxTokens = options.maxTokens || 10;
		this.refillRate = options.refillRate || 1; // 1 token per second
		this.identifier = options.identifier || ((req) => this.getClientIP(req) || 'unknown');
	}

	/**
	 * Extract client IP from request
	 */
	private getClientIP(request: Request): string | null {
		// Check common headers for client IP
		const forwardedFor = request.headers.get('x-forwarded-for');
		if (forwardedFor) {
			return forwardedFor.split(',')[0].trim();
		}

		const realIP = request.headers.get('x-real-ip');
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

		bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
		bucket.lastRefill = now;
	}

	/**
	 * Try to consume a token from the bucket
	 */
	tryConsume(request: Request, tokens: number = 1): boolean {
		return this.tryConsumeKey(this.identifier(request), tokens);
	}

	/**
	 * Try to consume a token from the bucket for an explicit key.
	 *
	 * The `Request`-derived key is the wrong one for an authenticated route: it
	 * falls back to client IP, so everyone behind one NAT shares a bucket while
	 * one user across two networks gets two. A caller that has already resolved
	 * who is asking — which every route behind the auth gate has — should key on
	 * that instead, and this is how.
	 */
	tryConsumeKey(key: string, tokens: number = 1): boolean {
		let bucket = this.buckets.get(key);

		// Create bucket if it doesn't exist
		if (!bucket) {
			if (this.buckets.size >= SWEEP_THRESHOLD) this.cleanup();
			bucket = {
				tokens: this.maxTokens,
				lastRefill: Date.now()
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
			maxTokens: this.maxTokens
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

	/** Seconds until one more token is available, for the Retry-After header. */
	retryAfterSeconds(): number {
		return Math.max(1, Math.ceil(1 / this.refillRate));
	}
}

// Create rate limiter instances for different endpoints
export const webhookRateLimiter = new RateLimiter({
	maxTokens: 20, // 20 requests
	refillRate: 0.5 // 1 request every 2 seconds
});

export const apiRateLimiter = new RateLimiter({
	maxTokens: 60, // 60 requests
	refillRate: 1 // 1 request per second
});

/**
 * Every write under /api/ai — assistant turns, letters, answers, stories,
 * cheat sheets, applying a proposal. Keyed on user id by the caller
 * (hooks.server.ts), never on IP.
 *
 * Credits already bound what a user can spend in a month, so this is not there
 * to cap cost — it is there to cap RATE. One assistant turn on a busy
 * application page assembles up to ~250k chars of evidence and calls the paid
 * writing model (see CHAT_BUDGET_CHARS); a script firing those in a loop is a
 * provider bill and a queue of slow requests before it is ever a credit
 * balance, and nothing else in the stack notices.
 *
 * 12/minute sustained with a burst of 15. A person clicking generate on a
 * letter, then an answer, then asking the assistant about both is nowhere near
 * it — these calls take seconds each, so the ceiling is roughly "faster than
 * anyone can read the output".
 */
export const aiRateLimiter = new RateLimiter({
	maxTokens: 15, // burst
	refillRate: 0.2 // 1 every 5s → 12/min sustained
});

/**
 * Every MCP call, keyed on the key id by the endpoint rather than on IP — an
 * agent and its user share an address, and a bucket per address would let one
 * runaway client starve every other on the same machine.
 *
 * Looser than the AI limiter because these calls are cheap: no provider is
 * involved, most of them are reads, and an agent legitimately makes several in
 * a row to orient itself before writing anything. It is here for the loop, not
 * for the bill — `DIRECT_WRITE_BURST` in `mcp/tiers.ts` is what bounds the
 * damage a loop can actually do, by turning writes into requests rather than by
 * refusing them.
 */
export const mcpRateLimiter = new RateLimiter({
	maxTokens: 30, // burst — an agent reading every section at once
	refillRate: 1 // 60/min sustained
});

/**
 * Create a rate limit response
 */
export function createRateLimitResponse(retryAfter: number = 60): Response {
	return new Response(
		JSON.stringify({
			error: 'Rate limit exceeded',
			message: 'Too many requests. Please try again later.',
			retryAfter
		}),
		{
			status: 429,
			headers: {
				'Content-Type': 'application/json',
				'Retry-After': String(retryAfter)
			}
		}
	);
}
