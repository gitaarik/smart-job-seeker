import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIMessage } from '@langchain/core/messages';

vi.mock('$lib/tools/get-env', () => ({
	getEnv: vi.fn(() => 'test-api-key')
}));

/**
 * `retryMaxAttempts: 1` on purpose. These tests are about what happens AFTER
 * the primary has given up, and the real value (3, with 1s/2s backoff) would
 * spend three seconds of wall clock per case proving something the retry tests
 * already cover.
 */
vi.mock('../config', () => ({
	config: {
		groqApiKey: 'test-groq-key',
		geminiApiKey: 'test-gemini-key',
		retryMaxAttempts: 1,
		retryInitialDelay: 1,
		retryMaxDelay: 2,
		llmCacheTTL: 3600000,
		llmProvider: 'groq',
		llmModel: 'openai/gpt-oss-120b',
		llmWritingProvider: 'gemini',
		llmWritingModel: 'gemini-2.5-pro'
	}
}));

const { mockGroqInvoke, mockGeminiInvoke } = vi.hoisted(() => ({
	mockGroqInvoke: vi.fn(),
	mockGeminiInvoke: vi.fn()
}));

vi.mock('@langchain/groq', () => ({
	ChatGroq: class ChatGroq {
		constructor() {}
		async invoke(messages: unknown) {
			return mockGroqInvoke(messages);
		}
	}
}));

vi.mock('@langchain/google-genai', () => ({
	ChatGoogleGenerativeAI: class ChatGoogleGenerativeAI {
		constructor() {}
		async invoke(messages: unknown) {
			return mockGeminiInvoke(messages);
		}
	}
}));

import { generateChatCompletionTracked } from '../llm';
import { llmCache } from '../llm/cache';
import {
	isFallbackEligible,
	LLMAuthenticationError,
	LLMOutputValidationError,
	LLMQuotaExceededError,
	LLMRateLimitError
} from '../llm/langchain';

const GEMINI = { provider: 'gemini', model: 'gemini-2.5-pro' };

function reply(content: string) {
	return new AIMessage({
		content,
		usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
	});
}

describe('isFallbackEligible', () => {
	/**
	 * The exclusions carry the whole design. Seven months of dev traffic holds
	 * 288 auth failures and 256 quota failures against 3 calls that failed
	 * because a provider was overloaded — so the class this must NOT fire on is
	 * two orders of magnitude more common than the class it exists for.
	 */
	it('refuses to fail over on a bad key', () => {
		expect(isFallbackEligible(new LLMAuthenticationError('bad key', 'gemini', 'x'))).toBe(false);
	});

	it('refuses to fail over on an empty balance', () => {
		expect(isFallbackEligible(new LLMQuotaExceededError('no credit', 'gemini', 'x'))).toBe(false);
	});

	it('fails over on a rate limit whose window is too long to wait out', () => {
		// No retryAfter, so `isRetryableError` declines to sit this one out. A
		// second provider is precisely the right answer to an exhausted quota.
		const error = new LLMRateLimitError('rate limit exceeded', 'gemini', 'x');
		expect(isFallbackEligible(error)).toBe(true);
	});

	it('fails over when the model could not produce valid output', () => {
		const error = new LLMOutputValidationError('json_validate_failed', 'gemini', 'x');
		expect(isFallbackEligible(error)).toBe(true);
	});

	it('fails over when the provider says it is overloaded', () => {
		expect(isFallbackEligible(new Error('[503] The model is overloaded.'))).toBe(true);
	});

	it('leaves an unrecognised error alone', () => {
		expect(isFallbackEligible(new Error('schema field "letter" is required'))).toBe(false);
	});
});

describe('writing failover', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		await llmCache.clear();
	});

	it('answers from the fallback when the primary is rate limited', async () => {
		mockGeminiInvoke.mockRejectedValueOnce(new Error('rate limit exceeded, try again later'));
		mockGroqInvoke.mockResolvedValueOnce(reply('drafted elsewhere'));

		const result = await generateChatCompletionTracked([{ role: 'user', content: 'letter 1' }], {
			...GEMINI,
			fallback: { provider: 'groq', model: 'openai/gpt-oss-120b' }
		});

		expect(result.content).toBe('drafted elsewhere');
		expect(result.fallbackUsed).toEqual({ provider: 'groq', model: 'openai/gpt-oss-120b' });
	});

	it('leaves fallbackUsed unset when the primary answers', async () => {
		mockGeminiInvoke.mockResolvedValueOnce(reply('drafted by the primary'));

		const result = await generateChatCompletionTracked([{ role: 'user', content: 'letter 2' }], {
			...GEMINI,
			fallback: { provider: 'groq', model: 'openai/gpt-oss-120b' }
		});

		expect(result.fallbackUsed).toBeUndefined();
		expect(mockGroqInvoke).not.toHaveBeenCalled();
	});

	it('does not spend money on the second provider when the key is bad', async () => {
		mockGeminiInvoke.mockRejectedValueOnce(new Error('401 invalid api key'));

		await expect(
			generateChatCompletionTracked([{ role: 'user', content: 'letter 3' }], {
				...GEMINI,
				fallback: { provider: 'groq', model: 'openai/gpt-oss-120b' }
			})
		).rejects.toThrow(LLMAuthenticationError);

		expect(mockGroqInvoke).not.toHaveBeenCalled();
	});

	it('does not retry the pair that just failed', async () => {
		mockGeminiInvoke.mockRejectedValueOnce(new Error('rate limit exceeded'));

		await expect(
			generateChatCompletionTracked([{ role: 'user', content: 'letter 4' }], {
				...GEMINI,
				fallback: { ...GEMINI }
			})
		).rejects.toThrow(LLMRateLimitError);

		expect(mockGeminiInvoke).toHaveBeenCalledTimes(1);
	});

	it("surfaces the primary's error when the fallback fails too", async () => {
		mockGeminiInvoke.mockRejectedValueOnce(new Error('rate limit exceeded'));
		mockGroqInvoke.mockRejectedValueOnce(new Error('econnrefused'));

		await expect(
			generateChatCompletionTracked([{ role: 'user', content: 'letter 5' }], {
				...GEMINI,
				fallback: { provider: 'groq', model: 'openai/gpt-oss-120b' }
			})
		).rejects.toThrow(LLMRateLimitError);

		expect(mockGroqInvoke).toHaveBeenCalledTimes(1);
	});

	it('tries the fallback exactly once, not on a second retry budget', async () => {
		mockGeminiInvoke.mockRejectedValue(new Error('rate limit exceeded'));
		mockGroqInvoke.mockRejectedValue(new Error('rate limit exceeded'));

		await expect(
			generateChatCompletionTracked([{ role: 'user', content: 'letter 6' }], {
				...GEMINI,
				fallback: { provider: 'groq', model: 'openai/gpt-oss-120b' }
			})
		).rejects.toThrow(LLMRateLimitError);

		expect(mockGroqInvoke).toHaveBeenCalledTimes(1);
	});
});
