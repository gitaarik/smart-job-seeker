/**
 * What createAndGenerateAiChat writes to `ai_chats` about the call itself:
 * which prompt it ran and which version of it, what the model spent, and how
 * long it took.
 *
 * Everything around the call is stubbed. The profile has no account, so no
 * spend or credit check runs, and the model is a mock that returns a fixed
 * answer and usage.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { inserts, updates, mockGenerate } = vi.hoisted(() => ({
	inserts: [] as Record<string, unknown>[],
	updates: [] as Record<string, unknown>[],
	mockGenerate: vi.fn()
}));

vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			profiles: { findFirst: vi.fn().mockResolvedValue({ user_id: null }) },
			ai_chats: {
				findFirst: vi.fn().mockResolvedValue({
					id: 7,
					profile_id: 1,
					system_prompt: '',
					user_prompt: '',
					full_prompt: '',
					response: 'short',
					date_created: null,
					date_updated: null
				})
			}
		},
		insert: () => ({
			values: (values: Record<string, unknown>) => {
				inserts.push(values);
				return { returning: async () => [{ id: 7, ...values }] };
			}
		}),
		update: () => ({
			set: (values: Record<string, unknown>) => {
				updates.push(values);
				return { where: async () => undefined };
			}
		})
	}
}));

vi.mock('../profile-data', async (importOriginal) => ({
	...(await importOriginal<typeof import('../profile-data')>()),
	loadProfileData: vi.fn().mockResolvedValue({ schema: {}, data: {} })
}));

vi.mock('$lib/server/llm', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/llm')>()),
	generateChatCompletionTracked: mockGenerate
}));

import { createAndGenerateAiChat } from '../utils';
import { promptTemplates } from '../prompt-templates';
import { promptFingerprint } from '../prompt-fingerprint';

describe('createAndGenerateAiChat: the record of the call', () => {
	beforeEach(() => {
		inserts.length = 0;
		updates.length = 0;
		mockGenerate.mockReset().mockResolvedValue({
			content: 'short',
			usage: {
				inputTokens: 100,
				outputTokens: 20,
				totalTokens: 120,
				cachedInputTokens: 0,
				reasoningTokens: 700
			}
		});
	});

	const run = () =>
		createAndGenerateAiChat(1, 'compact_job_description', { jobDescription: 'A long posting' });

	it('stores the prompt key and the fingerprint of the template that ran', async () => {
		const result = await run();

		expect(result.success).toBe(true);
		expect(inserts).toHaveLength(1);
		expect(inserts[0]).toMatchObject({
			prompt_key: 'compact_job_description',
			prompt_fingerprint: promptFingerprint(promptTemplates.compact_job_description)
		});
		expect(inserts[0].prompt_fingerprint).toMatch(/^[0-9a-f]{16}$/);
	});

	it('tells the model call which prompt it is making', async () => {
		await run();

		expect(mockGenerate).toHaveBeenCalledTimes(1);
		expect(mockGenerate.mock.calls[0][1]).toMatchObject({ promptKey: 'compact_job_description' });
	});

	it('records the thinking tokens, and leaves the credit basis alone', async () => {
		await run();

		const saved = updates.find((u) => 'response' in u);
		expect(saved).toMatchObject({
			output_tokens: 20,
			reasoning_tokens: 700,
			total_tokens: 120
		});
	});

	it('records how long the model call took', async () => {
		await run();

		const saved = updates.find((u) => 'response' in u);
		expect(saved?.duration_ms).toEqual(expect.any(Number));
		expect(saved?.duration_ms).toBeGreaterThanOrEqual(0);
	});

	it('records the duration and the spend of a failed call too', async () => {
		mockGenerate.mockReset().mockRejectedValue(
			Object.assign(new Error('no usable structured output'), {
				usage: {
					inputTokens: 100,
					outputTokens: 0,
					totalTokens: 100,
					cachedInputTokens: 0,
					reasoningTokens: 8000
				}
			})
		);

		const result = await run();

		expect(result.success).toBe(false);
		const failed = updates.find((u) => 'error' in u);
		expect(failed).toMatchObject({ reasoning_tokens: 8000, duration_ms: expect.any(Number) });
	});
});
