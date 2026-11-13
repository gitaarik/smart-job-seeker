/**
 * generateChatCompletionTracked and the daily spend ceiling: refused before the
 * provider is called, and each answered attempt tallied as the model that ran.
 * The ceiling itself is tested in spend-limit.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIMessage } from '@langchain/core/messages';

vi.mock('$lib/tools/get-env', () => ({
	getEnv: vi.fn(() => 'test-api-key')
}));

vi.mock('$lib/server/config', () => ({
	config: {
		geminiApiKey: 'test-gemini-key',
		geminiThinkingLevel: 'MEDIUM',
		retryMaxAttempts: 1,
		retryInitialDelay: 1,
		retryMaxDelay: 1,
		llmCacheTTL: 60000,
		llmProvider: 'gemini',
		llmModel: 'gemini-3.8-flash'
	}
}));

const { invoke, assertUnder, recordSpend } = vi.hoisted(() => ({
	invoke: vi.fn(),
	assertUnder: vi.fn(),
	recordSpend: vi.fn()
}));

vi.mock('@langchain/google-genai', () => ({
	ChatGoogleGenerativeAI: class ChatGoogleGenerativeAI {
		invoke = invoke;
	}
}));

vi.mock('../spend-limit.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../spend-limit.js')>()),
	assertUnderDailyLimit: assertUnder,
	recordSpend
}));

import { DailySpendLimitReached } from '../spend-limit.js';
import { generateChatCompletionTracked, LLMQuotaExceededError } from '../langchain';

const call = () =>
	generateChatCompletionTracked([{ role: 'user', content: 'hi' }], {
		provider: 'gemini',
		model: 'gemini-3.8-flash',
		cache: false
	});

beforeEach(() => {
	invoke.mockReset().mockResolvedValue(
		new AIMessage({
			content: 'An answer.',
			usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
		})
	);
	assertUnder.mockReset().mockResolvedValue(undefined);
	recordSpend.mockReset().mockResolvedValue(undefined);
});

describe('the spend ceiling in generateChatCompletionTracked', () => {
	it('refuses as a quota error without calling the provider', async () => {
		assertUnder.mockRejectedValue(new DailySpendLimitReached(26, 25));
		await expect(call()).rejects.toBeInstanceOf(LLMQuotaExceededError);
		await expect(call()).rejects.toThrow(/Daily AI spending limit reached/);
		expect(invoke).not.toHaveBeenCalled();
		expect(recordSpend).not.toHaveBeenCalled();
	});

	it('tallies an answered call once, as the provider and model that ran', async () => {
		await call();
		expect(recordSpend).toHaveBeenCalledTimes(1);
		expect(recordSpend).toHaveBeenCalledWith(
			'gemini',
			'gemini-3.8-flash',
			expect.objectContaining({ inputTokens: 10, outputTokens: 5 })
		);
	});
});
