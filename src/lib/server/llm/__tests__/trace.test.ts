/**
 * What the model wrapper sends to Langfuse (planning/LANGFUSE.md § Trace model,
 * "The LLM call"): a span per call, named by its prompt key and marked as a
 * cache hit or miss, and under it a generation per provider attempt. Exported
 * to memory through Langfuse's own processor, with the providers mocked as in
 * llm-fallback.test.ts.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIMessage } from '@langchain/core/messages';
import { InMemorySpanExporter, type ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { z } from 'zod';

vi.mock('$lib/tools/get-env', () => ({
	getEnv: vi.fn(() => 'test-api-key')
}));

// One attempt per provider, so a failure goes straight to the fallback.
vi.mock('$lib/server/config', () => ({
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

const { mockGroqInvoke, mockGeminiInvoke, mockResolvePrompt } = vi.hoisted(() => ({
	mockGroqInvoke: vi.fn(),
	mockGeminiInvoke: vi.fn(),
	mockResolvePrompt: vi.fn()
}));

// The registry's own behaviour is prompt-registry.test.ts; here only what it answers.
vi.mock('$lib/server/ai-chat/prompt-registry', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/ai-chat/prompt-registry')>()),
	resolvePrompt: mockResolvePrompt
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

import { generateChatCompletionTracked } from '$lib/server/llm';
import { promptRef } from '$lib/server/ai-chat/prompt-registry';
import { llmCache } from '$lib/server/llm/cache';
import { initTelemetry, type Telemetry } from '$lib/server/monitoring/telemetry';

const exporter = new InMemorySpanExporter();
let telemetry: Telemetry;

beforeAll(() => {
	telemetry = initTelemetry('script', {
		spanProcessors: [
			new LangfuseSpanProcessor({
				exporter,
				exportMode: 'immediate',
				publicKey: 'pk-lf-test',
				secretKey: 'sk-lf-test'
			})
		]
	});
});

beforeEach(async () => {
	vi.clearAllMocks();
	mockResolvePrompt.mockResolvedValue(null);
	await llmCache.clear();
	exporter.reset();
});

function reply(content: string) {
	return new AIMessage({
		content,
		usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
	});
}

async function exported(): Promise<ReadableSpan[]> {
	await telemetry.flush();
	return exporter.getFinishedSpans();
}

const typeOf = (span: ReadableSpan) => span.attributes['langfuse.observation.type'];
const generations = (spans: ReadableSpan[]) => spans.filter((s) => typeOf(s) === 'generation');

describe('the LLM call', () => {
	it('shows a forced fallback as two generations, the failed one at ERROR', async () => {
		mockGeminiInvoke.mockRejectedValueOnce(new Error('[503] The model is overloaded.'));
		mockGroqInvoke.mockResolvedValueOnce(reply('drafted elsewhere'));

		await generateChatCompletionTracked([{ role: 'user', content: 'a letter' }], {
			provider: 'gemini',
			model: 'gemini-2.5-pro',
			promptKey: 'write_cover_letter',
			fallback: { provider: 'groq', model: 'openai/gpt-oss-120b' }
		});

		const spans = await exported();
		const call = spans.find((s) => s.name === 'write_cover_letter');
		expect(call, 'the call is a span named by its prompt key').toBeDefined();
		expect(call!.attributes['langfuse.observation.metadata.cache']).toBe('miss');

		const [first, second] = generations(spans).sort(
			(a, b) => a.startTime[0] - b.startTime[0] || a.startTime[1] - b.startTime[1]
		);
		expect(first.name).toBe('gemini');
		expect(first.attributes['langfuse.observation.level']).toBe('ERROR');
		expect(first.attributes['langfuse.observation.status_message']).toContain('overloaded');
		expect(second.name).toBe('groq');
		expect(second.attributes['langfuse.observation.level']).toBeUndefined();
		expect(second.attributes['langfuse.observation.model.name']).toBe('openai/gpt-oss-120b');
		for (const generation of [first, second]) {
			expect(generation.parentSpanContext?.spanId).toBe(call!.spanContext().spanId);
		}
	});

	it('shows a cache hit as a span with no generation, since no model was called', async () => {
		mockGroqInvoke.mockResolvedValueOnce(reply('an answer'));
		const ask = () =>
			generateChatCompletionTracked([{ role: 'user', content: 'the same question' }], {
				promptKey: 'verification_email'
			});

		await ask();
		exporter.reset();
		await ask();

		const spans = await exported();
		expect(spans).toHaveLength(1);
		expect(spans[0].name).toBe('verification_email');
		expect(spans[0].attributes['langfuse.observation.metadata.cache']).toBe('hit');
		expect(mockGroqInvoke).toHaveBeenCalledTimes(1);
	});

	it('records the messages as sent, with the JSON reminder added for Groq', async () => {
		mockGroqInvoke.mockResolvedValueOnce(reply('{"cause":"wrong_password"}'));

		await generateChatCompletionTracked([{ role: 'user', content: 'Page text: locked out' }], {
			promptKey: 'login_block_cause',
			structuredOutput: { name: 'login_block_cause', schema: z.object({ cause: z.string() }) }
		});

		const [generation] = generations(await exported());
		const input = JSON.parse(String(generation.attributes['langfuse.observation.input']));
		expect(input).toHaveLength(1);
		expect(input[0].content).toContain('Page text: locked out');
		expect(input[0].content).toContain('Output ONLY a valid JSON object');
	});
});

describe("a generation's prompt version", () => {
	const letter = () => promptRef('write_cover_letter')!;
	const writeLetter = (options: { promptFingerprint?: string } = {}) =>
		generateChatCompletionTracked([{ role: 'user', content: `a letter ${Math.random()}` }], {
			provider: 'gemini',
			model: 'gemini-2.5-pro',
			promptKey: 'write_cover_letter',
			...options
		});

	it('links to the registered version of its template', async () => {
		mockResolvePrompt.mockResolvedValue({ name: 'write_cover_letter', version: 3 });
		mockGeminiInvoke.mockResolvedValueOnce(reply('Dear team'));

		await writeLetter();

		const [generation] = generations(await exported());
		expect(mockResolvePrompt).toHaveBeenCalledWith(letter());
		expect(generation.attributes['langfuse.observation.prompt.name']).toBe('write_cover_letter');
		expect(generation.attributes['langfuse.observation.prompt.version']).toBe(3);
		expect(generation.attributes['langfuse.observation.metadata.prompt_fingerprint']).toBe(
			letter().fingerprint
		);
	});

	it('ends unlinked, with its fingerprint, when the version is not known in time', async () => {
		mockResolvePrompt.mockReturnValue(new Promise(() => {}));
		mockGeminiInvoke.mockResolvedValueOnce(reply('Dear team'));

		await writeLetter();

		const [generation] = generations(await exported());
		expect(generation.attributes['langfuse.observation.prompt.name']).toBeUndefined();
		expect(generation.attributes['langfuse.observation.metadata.prompt_fingerprint']).toBe(
			letter().fingerprint
		);
	});

	it('looks up the version a replayed row ran, not the template as it is now', async () => {
		mockGeminiInvoke.mockResolvedValueOnce(reply('Dear team'));

		await writeLetter({ promptFingerprint: '0123456789abcdef' });

		expect(mockResolvePrompt).toHaveBeenCalledWith({
			key: 'write_cover_letter',
			fingerprint: '0123456789abcdef'
		});
	});

	it('looks nothing up for an inline prompt', async () => {
		mockGroqInvoke.mockResolvedValueOnce(reply('{"code": "1"}'));

		await generateChatCompletionTracked([{ role: 'user', content: 'an email' }], {
			promptKey: 'verification_email'
		});

		const [generation] = generations(await exported());
		expect(mockResolvePrompt).not.toHaveBeenCalled();
		expect(
			generation.attributes['langfuse.observation.metadata.prompt_fingerprint']
		).toBeUndefined();
	});
});
