/**
 * Tool calling through the model wrapper (planning/ASSISTANT-AGENT.md, Phase
 * 1): the definitions bound, the calls handed back, an earlier round replayed
 * as the provider's own messages, the cache kept out of it, and the fallback
 * bound to the same tools. The providers are mocked as in llm.test.ts, so this
 * holds the wrapper's contract and not the models' behaviour; what Gemini does
 * with the real schemas is the spike (cloud/scripts/spike-agent-tools.ts).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIMessage, ToolMessage } from '@langchain/core/messages';
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
		llmModel: 'openai/gpt-oss-120b'
	}
}));

const { groq, gemini } = vi.hoisted(() => ({
	groq: { bind: vi.fn(), invoke: vi.fn(), built: vi.fn() },
	gemini: { bind: vi.fn(), invoke: vi.fn(), built: vi.fn() }
}));

vi.mock('@langchain/groq', () => ({
	ChatGroq: class ChatGroq {
		disableStreaming = false;
		constructor() {
			groq.built(this);
		}
		async invoke(messages: unknown) {
			return groq.invoke(messages);
		}
		bindTools(tools: unknown, kwargs?: unknown) {
			groq.bind(tools, kwargs);
			return { invoke: (messages: unknown) => groq.invoke(messages) };
		}
	}
}));

vi.mock('@langchain/google-genai', () => ({
	ChatGoogleGenerativeAI: class ChatGoogleGenerativeAI {
		disableStreaming = false;
		constructor() {
			gemini.built(this);
		}
		async invoke(messages: unknown) {
			return gemini.invoke(messages);
		}
		bindTools(tools: unknown, kwargs?: unknown) {
			gemini.bind(tools, kwargs);
			return { invoke: (messages: unknown) => gemini.invoke(messages) };
		}
	}
}));

import {
	generateChatCompletionTracked,
	LLMOutputValidationError,
	type ChatMessage,
	type ToolDefinition
} from '$lib/server/llm';
import { llmCache } from '$lib/server/llm/cache';

const readJob: ToolDefinition = {
	name: 'read_job',
	description: 'One job in full.',
	parameters: {
		type: 'object',
		properties: { job_id: { type: 'integer' } },
		required: ['job_id'],
		additionalProperties: false
	}
};
const listJobs: ToolDefinition = {
	name: 'list_jobs',
	description: 'The jobs this applicant has.',
	parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }
};

const usage = { input_tokens: 10, output_tokens: 5, total_tokens: 15 };

/** A reply that calls `read_job`, with text beside it and Gemini-style provider data. */
function callingReply() {
	return new AIMessage({
		content: 'Let me read it.',
		tool_calls: [{ id: 'call_1', name: 'read_job', args: { job_id: 7 }, type: 'tool_call' }],
		additional_kwargs: { __signatures__: { call_1: 'sig' } },
		usage_metadata: usage
	});
}

beforeEach(async () => {
	vi.clearAllMocks();
	await llmCache.clear();
});

describe('a call with tools', () => {
	it('binds them as function definitions and hands back the calls beside the text', async () => {
		groq.invoke.mockResolvedValueOnce(callingReply());

		const result = await generateChatCompletionTracked([{ role: 'user', content: 'job 7?' }], {
			tools: [readJob, listJobs]
		});

		expect(groq.bind).toHaveBeenCalledTimes(1);
		const [bound, kwargs] = groq.bind.mock.calls[0];
		expect(bound).toEqual([
			{
				type: 'function',
				function: {
					name: 'read_job',
					description: 'One job in full.',
					parameters: readJob.parameters
				}
			},
			{
				type: 'function',
				function: {
					name: 'list_jobs',
					description: 'The jobs this applicant has.',
					parameters: listJobs.parameters
				}
			}
		]);
		// The provider's own default, which is 'auto' on every one of them.
		expect(kwargs).toBeUndefined();

		expect(result.content).toBe('Let me read it.');
		expect(result.toolCalls).toEqual([{ id: 'call_1', name: 'read_job', args: { job_id: 7 } }]);
		expect(result.providerData).toEqual({ __signatures__: { call_1: 'sig' } });
		expect(result.usage?.totalTokens).toBe(15);
	});

	it('is built with streaming off, so a call inside a streamed graph reports one usage block', async () => {
		// google-genai 2.3.2 repeats the cached count on every streamed chunk and
		// LangChain adds the chunks up (langchain.ts, withoutStreaming). The field
		// is set on the instance, because the constructor ignores it.
		groq.invoke.mockResolvedValueOnce(new AIMessage({ content: 'ok', usage_metadata: usage }));
		await generateChatCompletionTracked([{ role: 'user', content: 'hi' }], { tools: [readJob] });
		expect(groq.built).toHaveBeenCalledTimes(1);
		expect((groq.built.mock.calls[0][0] as { disableStreaming: boolean }).disableStreaming).toBe(
			true
		);

		gemini.invoke.mockResolvedValueOnce(new AIMessage({ content: 'ok', usage_metadata: usage }));
		await generateChatCompletionTracked([{ role: 'user', content: 'hi' }], {
			provider: 'gemini',
			model: 'gemini-2.5-pro'
		});
		expect(gemini.built).toHaveBeenCalledTimes(1);
		expect((gemini.built.mock.calls[0][0] as { disableStreaming: boolean }).disableStreaming).toBe(
			true
		);
	});

	it('is a plain reply, with no calls at all, when the model made none', async () => {
		groq.invoke.mockResolvedValueOnce(
			new AIMessage({ content: 'Nothing to read.', usage_metadata: usage })
		);

		const result = await generateChatCompletionTracked([{ role: 'user', content: 'hi' }], {
			tools: [readJob]
		});

		expect(result.content).toBe('Nothing to read.');
		expect('toolCalls' in result).toBe(false);
		expect('providerData' in result).toBe(false);
	});

	it('reads the text out of a reply that arrived in blocks, and accepts one with no text', async () => {
		groq.invoke.mockResolvedValueOnce(
			new AIMessage({
				content: [
					{ type: 'thinking', thinking: 'which one' },
					{ type: 'text', text: 'One ' },
					{ type: 'text', text: 'moment.' }
				],
				tool_calls: [{ id: 'c', name: 'list_jobs', args: {}, type: 'tool_call' }],
				usage_metadata: usage
			})
		);
		groq.invoke.mockResolvedValueOnce(
			new AIMessage({
				content: '',
				tool_calls: [{ id: 'd', name: 'list_jobs', args: {}, type: 'tool_call' }],
				usage_metadata: usage
			})
		);

		const blocks = await generateChatCompletionTracked([{ role: 'user', content: 'a' }], {
			tools: [listJobs]
		});
		expect(blocks.content).toBe('One moment.');
		expect(blocks.toolCalls?.map((c) => c.name)).toEqual(['list_jobs']);

		const silent = await generateChatCompletionTracked([{ role: 'user', content: 'b' }], {
			tools: [listJobs]
		});
		expect(silent.content).toBe('');
		expect(silent.toolCalls).toHaveLength(1);
	});

	it('replays an earlier round as the provider’s own call and result messages', async () => {
		groq.invoke.mockResolvedValueOnce(
			new AIMessage({ content: 'Remote, 120 to 140k.', usage_metadata: usage })
		);
		const messages: ChatMessage[] = [
			{ role: 'system', content: 'You read jobs.' },
			{ role: 'user', content: 'job 7?' },
			{
				role: 'assistant',
				content: '',
				toolCalls: [{ id: 'call_1', name: 'read_job', args: { job_id: 7 } }],
				providerData: { __signatures__: { call_1: 'sig' } }
			},
			{ role: 'tool', toolCallId: 'call_1', name: 'read_job', content: '{"id":7,"remote":true}' },
			{ role: 'tool', toolCallId: 'call_2', name: 'read_job', content: 'No job 8.', isError: true }
		];

		await generateChatCompletionTracked(messages, { tools: [readJob] });

		const sent = groq.invoke.mock.calls[0][0] as unknown[];
		expect(sent).toHaveLength(5);
		const call = sent[2] as AIMessage;
		expect(call).toBeInstanceOf(AIMessage);
		expect(call.content).toBe('');
		expect(call.tool_calls).toEqual([
			{ id: 'call_1', name: 'read_job', args: { job_id: 7 }, type: 'tool_call' }
		]);
		expect(call.additional_kwargs).toEqual({ __signatures__: { call_1: 'sig' } });
		const answer = sent[3] as ToolMessage;
		expect(answer).toBeInstanceOf(ToolMessage);
		expect(answer.tool_call_id).toBe('call_1');
		expect(answer.name).toBe('read_job');
		expect(answer.content).toBe('{"id":7,"remote":true}');
		expect(answer.status).toBe('success');
		expect((sent[4] as ToolMessage).status).toBe('error');
	});

	it('asks the model every time: the response cache neither answers nor keeps it', async () => {
		groq.invoke.mockResolvedValue(new AIMessage({ content: 'An answer.', usage_metadata: usage }));
		const ask = () =>
			generateChatCompletionTracked([{ role: 'user', content: 'the same question' }], {
				tools: [readJob]
			});

		const first = await ask();
		const second = await ask();

		expect(groq.invoke).toHaveBeenCalledTimes(2);
		expect(first.fromCache).toBeUndefined();
		expect(second.fromCache).toBeUndefined();
		// Nor did the tool call leave an answer behind for the same messages asked
		// without tools, which the cache would otherwise serve.
		await generateChatCompletionTracked([{ role: 'user', content: 'the same question' }]);
		expect(groq.invoke).toHaveBeenCalledTimes(3);
	});

	it('can forbid calls, for the round that has to be the reply', async () => {
		groq.invoke.mockResolvedValueOnce(
			new AIMessage({ content: 'Done reading.', usage_metadata: usage })
		);

		await generateChatCompletionTracked([{ role: 'user', content: 'wrap up' }], {
			tools: [readJob],
			toolChoice: 'none'
		});

		expect(groq.bind.mock.calls[0][1]).toEqual({ tool_choice: 'none' });
	});

	it('gives the fallback the same tools', async () => {
		gemini.invoke.mockRejectedValueOnce(new Error('[503] The model is overloaded.'));
		groq.invoke.mockResolvedValueOnce(callingReply());

		const result = await generateChatCompletionTracked([{ role: 'user', content: 'job 7?' }], {
			provider: 'gemini',
			model: 'gemini-2.5-pro',
			tools: [readJob],
			fallback: { provider: 'groq', model: 'openai/gpt-oss-120b' }
		});

		expect(gemini.bind.mock.calls[0][0]).toEqual(groq.bind.mock.calls[0][0]);
		expect(result.fallbackUsed).toEqual({ provider: 'groq', model: 'openai/gpt-oss-120b' });
		expect(result.toolCalls).toHaveLength(1);
	});

	it('fails a call whose arguments did not parse, with the tokens it cost', async () => {
		groq.invoke.mockResolvedValueOnce(
			new AIMessage({
				content: '',
				invalid_tool_calls: [
					{
						name: 'read_job',
						args: '{"job_id": ',
						error: 'Unexpected end',
						type: 'invalid_tool_call'
					}
				],
				usage_metadata: usage
			})
		);

		const failed = generateChatCompletionTracked([{ role: 'user', content: 'job 7?' }], {
			tools: [readJob]
		});
		await expect(failed).rejects.toBeInstanceOf(LLMOutputValidationError);
		await expect(failed).rejects.toMatchObject({ usage: { totalTokens: 15 } });
	});

	it('refuses tools together with structured output, before any model is called', async () => {
		await expect(
			generateChatCompletionTracked([{ role: 'user', content: 'x' }], {
				tools: [readJob],
				structuredOutput: { name: 'x', schema: z.object({ a: z.string() }) }
			})
		).rejects.toThrow(/cannot bind tools and ask for structured output/);
		expect(groq.invoke).not.toHaveBeenCalled();
	});
});
