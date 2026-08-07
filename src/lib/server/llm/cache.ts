/**
 * LLM Response Caching
 * In-memory cache with TTL for LLM responses
 * Reduces redundant API calls and costs
 */

import { createHash } from 'crypto';

interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

class LLMCache {
	private cache = new Map<string, CacheEntry<string>>();
	private defaultTTL = 1000 * 60 * 60; // 1 hour in milliseconds

	/**
	 * Generate a cache key from prompt and model
	 */
	private generateKey(prompt: string, model?: string): string {
		const content = model ? `${model}:${prompt}` : prompt;
		return createHash('sha256').update(content).digest('hex');
	}

	/**
	 * Get cached response if available and not expired
	 */
	get(prompt: string, model?: string): string | null {
		const key = this.generateKey(prompt, model);
		const entry = this.cache.get(key);

		if (!entry) {
			return null;
		}

		// Check if expired
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			return null;
		}

		return entry.value;
	}

	/**
	 * Set cache entry with optional TTL
	 */
	set(prompt: string, response: string, model?: string, ttl?: number): void {
		const key = this.generateKey(prompt, model);
		const expiresAt = Date.now() + (ttl || this.defaultTTL);

		this.cache.set(key, {
			value: response,
			expiresAt
		});
	}

	/**
	 * Clear expired entries
	 */
	clearExpired(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (now > entry.expiresAt) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Clear all cache entries
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * Get cache statistics
	 */
	getStats(): { size: number; keys: number } {
		return {
			size: this.cache.size,
			keys: Array.from(this.cache.keys()).length
		};
	}
}

// Export singleton instance
export const llmCache = new LLMCache();
