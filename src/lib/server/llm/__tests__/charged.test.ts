/**
 * generateChatCompletionCharged: the model call, and its tokens charged to the
 * user it was made for.
 *
 * The model and the ledger are mocks; the credit arithmetic and the pricing
 * are the real ones.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { mockTracked, mockCharge, mockWarn } = vi.hoisted(() => ({
	mockTracked: vi.fn(),
	mockCharge: vi.fn(),
	mockWarn: vi.fn()
}));

vi.mock('../langchain.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../langchain.js')>()),
	generateChatCompletionTracked: mockTracked
}));

vi.mock('$lib/server/billing/credits', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/billing/credits')>()),
	chargeCredits: mockCharge
}));

vi.mock('$lib/server/monitoring/error-tracker', () => ({
	errorTracker: { logWarning: mockWarn }
}));

import { generateChatCompletionCharged } from '../charged';

const messages = [{ role: 'user' as const, content: 'Translate this' }];
const usage = {
	inputTokens: 9000,
	outputTokens: 2000,
	reasoningTokens: 4000,
	totalTokens: 15000,
	cachedInputTokens: 0
};

describe('generateChatCompletionCharged', () => {
	beforeEach(() => {
		mockTracked.mockReset().mockResolvedValue({ content: 'Vertaal dit', usage });
		mockCharge.mockReset().mockResolvedValue(undefined);
		mockWarn.mockReset();
	});

	it('charges the tokens to the user, thinking included', async () => {
		const out = await generateChatCompletionCharged('user-1', messages, {
			provider: 'gemini',
			model: 'gemini-2.5-pro',
			promptKey: 'translate_fields'
		});

		expect(out).toBe('Vertaal dit');
		expect(mockCharge).toHaveBeenCalledTimes(1);
		const [userId, credits, operation, description, metadata] = mockCharge.mock.calls[0];
		expect(userId).toBe('user-1');
		// 15,000 tokens at 1 credit per 10,000, rounded up.
		expect(credits).toBe(2);
		expect(operation).toBe('ai_generation');
		expect(description).toBe('translate_fields (15000 tokens)');
		expect(metadata).toMatchObject({
			promptKey: 'translate_fields',
			tokens: usage,
			provider: 'gemini',
			model: 'gemini-2.5-pro'
		});
		expect(metadata.providerCostUsd).toBeGreaterThan(0);
	});

	it('prices the fallback when the fallback answered', async () => {
		mockTracked.mockResolvedValue({
			content: 'ok',
			usage,
			fallbackUsed: { provider: 'groq', model: 'openai/gpt-oss-120b' }
		});

		await generateChatCompletionCharged('user-1', messages, {
			provider: 'gemini',
			model: 'gemini-2.5-pro',
			promptKey: 'translate_fields'
		});

		expect(mockCharge.mock.calls[0][4]).toMatchObject({
			provider: 'groq',
			model: 'openai/gpt-oss-120b'
		});
	});

	it('charges nobody for a call made on no user’s behalf', async () => {
		await generateChatCompletionCharged(null, messages, { promptKey: 'search_form_map' });
		expect(mockCharge).not.toHaveBeenCalled();
	});

	it('charges nothing for a response-cache hit, which spent nothing', async () => {
		mockTracked.mockResolvedValue({ content: 'cached', usage: null });

		const out = await generateChatCompletionCharged('user-1', messages);

		expect(out).toBe('cached');
		expect(mockCharge).not.toHaveBeenCalled();
	});

	it('charges nothing for a call that throws', async () => {
		mockTracked.mockRejectedValue(new Error('rate limited'));

		await expect(generateChatCompletionCharged('user-1', messages)).rejects.toThrow('rate limited');
		expect(mockCharge).not.toHaveBeenCalled();
	});

	it('parses structured output, and charges an answer that does not parse', async () => {
		const schema = z.object({ cause: z.string() });
		mockTracked.mockResolvedValueOnce({ content: '{"cause":"captcha"}', usage });

		const parsed = await generateChatCompletionCharged<{ cause: string }>('user-1', messages, {
			structuredOutput: { name: 'login_block_cause', schema },
			promptKey: 'login_block_cause'
		});
		expect(parsed).toEqual({ cause: 'captcha' });

		mockTracked.mockResolvedValueOnce({ content: 'not json', usage });
		await expect(
			generateChatCompletionCharged('user-1', messages, {
				structuredOutput: { name: 'login_block_cause', schema },
				promptKey: 'login_block_cause'
			})
		).rejects.toThrow('Failed to parse JSON');
		// The provider billed it all the same.
		expect(mockCharge).toHaveBeenCalledTimes(2);
	});

	it('returns the answer when the charge fails, and says so', async () => {
		mockCharge.mockRejectedValue(new Error('database is down'));

		const out = await generateChatCompletionCharged('user-1', messages, {
			promptKey: 'verification_email'
		});

		expect(out).toBe('Vertaal dit');
		expect(mockWarn).toHaveBeenCalledWith(
			'Could not charge a model call to its user',
			expect.objectContaining({
				metadata: expect.objectContaining({ userId: 'user-1', promptKey: 'verification_email' })
			})
		);
	});
});
