/**
 * What the Gemini binding is constructed with, per model generation.
 *
 * The provider mocks in llm.test.ts ignore the constructor. This file is the
 * one that reads it, because the two things it carries show up nowhere else:
 * the thinking dial (a numeric budget on 2.5, a level on 3.x) and the
 * sampling parameters, which 3.x ignores and a later generation refuses. The
 * probe numbers behind the rules are with createLangChainModel in langchain.ts.
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

const { constructed } = vi.hoisted(() => ({ constructed: [] as Record<string, unknown>[] }));

vi.mock('@langchain/google-genai', () => ({
	ChatGoogleGenerativeAI: class ChatGoogleGenerativeAI {
		constructor(fields: Record<string, unknown>) {
			constructed.push(fields);
		}
		async invoke() {
			return new AIMessage({
				content: 'An answer.',
				usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
			});
		}
	}
}));

import { generateChatCompletion } from '../../llm';
import { config } from '$lib/server/config';

async function construct(model: string, maxTokens = 1000): Promise<Record<string, unknown>> {
	constructed.length = 0;
	await generateChatCompletion([{ role: 'user', content: 'hi' }], {
		provider: 'gemini',
		model,
		maxTokens,
		temperature: 0.3,
		cache: false
	});
	expect(constructed).toHaveLength(1);
	return constructed[0];
}

describe('the Gemini binding per model generation', () => {
	beforeEach(() => {
		config.geminiThinkingLevel = 'MEDIUM';
	});

	it('3.x: a thinking level, room for the thoughts, and no sampling parameters', async () => {
		const fields = await construct('gemini-3.8-flash');
		expect(fields.thinkingConfig).toEqual({ thinkingLevel: 'MEDIUM' });
		expect(fields.maxOutputTokens).toBe(2000);
		expect(fields).not.toHaveProperty('temperature');
		expect(fields).not.toHaveProperty('topP');
		expect(fields).not.toHaveProperty('topK');
	});

	it('3.x: the level is the configured one', async () => {
		config.geminiThinkingLevel = 'HIGH';
		const fields = await construct('gemini-3.8-flash');
		expect(fields.thinkingConfig).toEqual({ thinkingLevel: 'HIGH' });
	});

	it('reads the generation off the model id, with or without a minor version', async () => {
		for (const model of ['gemini-3-pro-preview', 'gemini-3.1-pro-preview', 'gemini-4-argon']) {
			const fields = await construct(model);
			expect(fields.thinkingConfig).toEqual({ thinkingLevel: 'MEDIUM' });
			expect(fields).not.toHaveProperty('temperature');
		}
	});

	it('2.5: a numeric budget on top of the answer, and the temperature', async () => {
		const fields = await construct('gemini-2.5-pro', 1000);
		expect(fields.thinkingConfig).toEqual({ thinkingBudget: 500 });
		expect(fields.maxOutputTokens).toBe(1500);
		expect(fields.temperature).toBe(0.3);
	});

	it('2.5: never a budget below 128', async () => {
		const fields = await construct('gemini-2.5-flash-lite', 100);
		expect(fields.thinkingConfig).toEqual({ thinkingBudget: 128 });
		expect(fields.maxOutputTokens).toBe(228);
	});

	it('before 2.5: no thinking field at all', async () => {
		const fields = await construct('gemini-2.0-flash-exp', 1000);
		expect(fields).not.toHaveProperty('thinkingConfig');
		expect(fields.maxOutputTokens).toBe(1000);
		expect(fields.temperature).toBe(0.3);
	});
});
