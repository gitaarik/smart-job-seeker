import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, StructuredOutputConfig } from '../llm';
import { AIMessage } from '@langchain/core/messages';
import { z } from 'zod';

// Mock getEnv
vi.mock('$lib/tools/get-env', () => ({
	getEnv: vi.fn(() => 'test-api-key')
}));

// Mock config
vi.mock('../config', () => ({
	config: {
		groqApiKey: 'test-api-key',
		retryMaxAttempts: 3,
		retryInitialDelay: 1000,
		retryMaxDelay: 10000,
		llmCacheTTL: 3600000,
		llmProvider: 'groq',
		llmModel: 'openai/gpt-oss-120b'
	}
}));

// Create hoisted mocks for LangChain
const { mockInvoke, mockWithStructuredOutput, mockGeminiInvoke, mockGeminiStructuredInvoke } =
	vi.hoisted(() => ({
		mockInvoke: vi.fn(),
		mockWithStructuredOutput: vi.fn(),
		mockGeminiInvoke: vi.fn(),
		mockGeminiStructuredInvoke: vi.fn()
	}));

vi.mock('@langchain/google-genai', () => ({
	ChatGoogleGenerativeAI: class ChatGoogleGenerativeAI {
		constructor(config: any) {}
		async invoke(messages: any, options?: any) {
			return mockGeminiInvoke(messages);
		}
		// Everything except Groq and Cerebras goes through withStructuredOutput,
		// so this is the path the writing model actually takes.
		withStructuredOutput(_schema: any, _options?: any) {
			return { invoke: (m: any) => mockGeminiStructuredInvoke(m) };
		}
	}
}));

// Mock LangChain Groq
vi.mock('@langchain/groq', () => ({
	ChatGroq: class ChatGroq {
		constructor(config: any) {}
		async invoke(messages: any, options?: any) {
			return mockInvoke(messages);
		}
		withStructuredOutput(schema: any, options?: any) {
			return mockWithStructuredOutput(schema, options);
		}
	}
}));

import { generateChatCompletion } from '../llm';
import { llmCache } from '../llm/cache';

describe('generateChatCompletion', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		// Clear LLM cache to prevent cache hits affecting tests
		await llmCache.clear();
	});

	it('should generate chat completion with default options', async () => {
		const messages: ChatMessage[] = [
			{ role: 'system', content: 'You are a helpful assistant' },
			{ role: 'user', content: 'Hello' }
		];

		// Mock LangChain response (returns AIMessage)
		mockInvoke.mockResolvedValueOnce(new AIMessage('Hi there! How can I help you?'));

		const result = await generateChatCompletion(messages);

		expect(result).toBe('Hi there! How can I help you?');
		expect(mockInvoke).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ content: 'You are a helpful assistant' }),
				expect.objectContaining({ content: 'Hello' })
			])
		);
	});

	it('should use custom options', async () => {
		const messages: ChatMessage[] = [{ role: 'user', content: 'Test' }];

		mockInvoke.mockResolvedValueOnce(new AIMessage('Response'));

		await generateChatCompletion(messages, {
			model: 'custom-model',
			maxTokens: 1024,
			temperature: 0.5
		});

		expect(mockInvoke).toHaveBeenCalledWith(
			expect.arrayContaining([expect.objectContaining({ content: 'Test' })])
		);
	});

	it('should include structured output using Zod schema', async () => {
		const messages: ChatMessage[] = [{ role: 'user', content: 'Extract data' }];

		const structuredOutput: StructuredOutputConfig = {
			name: 'test_schema',
			schema: z.object({
				name: z.string()
			})
		};

		// For Groq provider, structured output uses JSON mode (invoke returns JSON string)
		mockInvoke.mockResolvedValueOnce(new AIMessage('{"name": "test"}'));

		const result = await generateChatCompletion(messages, { structuredOutput });

		// Should return parsed JSON object, not string
		expect(result).toEqual({ name: 'test' });
		expect(mockInvoke).toHaveBeenCalled();
	});

	it('should throw error if no content is returned', async () => {
		const messages: ChatMessage[] = [{ role: 'user', content: 'Test' }];

		// Mock empty response
		mockInvoke.mockResolvedValueOnce(new AIMessage(''));

		await expect(generateChatCompletion(messages)).rejects.toThrow('No content returned from groq');
	});

	it('should throw error if response is not a string', async () => {
		const messages: ChatMessage[] = [{ role: 'user', content: 'Test' }];

		// Mock non-string response
		mockInvoke.mockResolvedValueOnce({ content: ['array', 'content'] });

		await expect(generateChatCompletion(messages)).rejects.toThrow(
			'Expected string response from LangChain model'
		);
	});

	it('should handle multi-turn conversations', async () => {
		const messages: ChatMessage[] = [
			{ role: 'system', content: 'You are helpful' },
			{ role: 'user', content: "What's 2+2?" },
			{ role: 'assistant', content: '4' },
			{ role: 'user', content: "What's 3+3?" }
		];

		mockInvoke.mockResolvedValueOnce(new AIMessage('6'));

		const result = await generateChatCompletion(messages);

		expect(result).toBe('6');
		expect(mockInvoke).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ content: 'You are helpful' }),
				expect.objectContaining({ content: "What's 2+2?" }),
				expect.objectContaining({ content: '4' }),
				expect.objectContaining({ content: "What's 3+3?" })
			])
		);
	});

	// A large system prompt used to be deleted and glued onto the FIRST user
	// message on Gemini, on the belief that systemInstruction was capped at 1000
	// characters. Every writing prompt we send is far larger than that, so Gemini
	// was receiving no system message at all — and once threads became real
	// conversations, "first user message" was the oldest turn, which would have
	// buried the whole context block mid-thread.
	describe('Gemini system messages', () => {
		it('keeps a large system message intact instead of merging it', async () => {
			const systemPrompt = 'S'.repeat(5000);
			const messages: ChatMessage[] = [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: 'Oldest turn' },
				{ role: 'assistant', content: 'A reply' },
				{ role: 'user', content: 'Newest turn' }
			];

			mockGeminiInvoke.mockResolvedValueOnce(new AIMessage('ok'));

			const result = await generateChatCompletion(messages, {
				provider: 'gemini',
				model: 'gemini-2.5-pro'
			});

			expect(result).toBe('ok');
			const sent = mockGeminiInvoke.mock.calls[0][0];
			expect(sent).toHaveLength(4);
			expect(sent[0].getType()).toBe('system');
			expect(sent[0].content).toBe(systemPrompt);
			// The oldest turn must stay exactly what the applicant said.
			expect(sent[1].content).toBe('Oldest turn');
			expect(sent[3].content).toBe('Newest turn');
		});
	});

	it('should propagate API errors', async () => {
		const messages: ChatMessage[] = [{ role: 'user', content: 'Test' }];

		mockInvoke.mockRejectedValueOnce(new Error('API Error'));

		await expect(generateChatCompletion(messages)).rejects.toThrow('API Error');
	});

	it('should handle empty message content', async () => {
		const messages: ChatMessage[] = [{ role: 'user', content: '' }];

		mockInvoke.mockResolvedValueOnce(new AIMessage('Please provide a message.'));

		const result = await generateChatCompletion(messages);

		expect(result).toBe('Please provide a message.');
	});

	it('should throw descriptive error for invalid JSON when structuredOutput provided', async () => {
		const messages: ChatMessage[] = [{ role: 'user', content: 'Extract data' }];

		const structuredOutput: StructuredOutputConfig = {
			name: 'test',
			schema: z.object({
				name: z.string()
			})
		};

		// For Groq provider, mock invalid JSON response
		mockInvoke.mockResolvedValueOnce(new AIMessage('This is not valid JSON'));

		await expect(generateChatCompletion(messages, { structuredOutput })).rejects.toThrow(
			/Failed to parse JSON response[\s\S]*Response was:/
		);
	});

	it('should use cache for repeated requests', async () => {
		const messages: ChatMessage[] = [{ role: 'user', content: 'Test caching' }];

		mockInvoke.mockResolvedValueOnce(new AIMessage('Cached response'));

		// First call
		const result1 = await generateChatCompletion(messages);
		expect(result1).toBe('Cached response');
		expect(mockInvoke).toHaveBeenCalledTimes(1);

		// Second call - should use cache
		const result2 = await generateChatCompletion(messages);
		expect(result2).toBe('Cached response');
		expect(mockInvoke).toHaveBeenCalledTimes(1); // Still 1, not called again
	});

	it('should handle rate limit errors with enhanced messages', async () => {
		const messages: ChatMessage[] = [{ role: 'user', content: 'Test' }];

		const rateLimitError = new Error(
			'Rate limit exceeded. Please try again in 5m30s. Limit 500000, Used 495000, Requested 10000'
		);
		mockInvoke.mockRejectedValueOnce(rateLimitError);

		await expect(generateChatCompletion(messages)).rejects.toThrow(
			/🚫 Rate limit exceeded for groq/
		);
	});

	it('should handle quota exceeded errors', async () => {
		const messages: ChatMessage[] = [{ role: 'user', content: 'Test' }];

		const quotaError = new Error('402: Insufficient balance');
		mockInvoke.mockRejectedValueOnce(quotaError);

		await expect(generateChatCompletion(messages)).rejects.toThrow(
			/💳 Quota\/balance exceeded for groq/
		);
	});

	it('should handle authentication errors', async () => {
		const messages: ChatMessage[] = [{ role: 'user', content: 'Test' }];

		const authError = new Error('401: Invalid API key');
		mockInvoke.mockRejectedValueOnce(authError);

		await expect(generateChatCompletion(messages)).rejects.toThrow(
			/🔐 Authentication failed for groq/
		);
	});
});

/**
 * A structured generation that produced nothing usable.
 *
 * `withStructuredOutput` resolves `parsed: null` when the model returns no
 * valid structured output, and `JSON.stringify(null)` is the string "null" —
 * which used to be returned as successful content. It was saved to ai_chats
 * with no error, charged for, and then crashed the assistant endpoint, which
 * did `JSON.parse("null").reply`. The user saw "Internal Error" for a turn
 * that had already spent 1783 output tokens.
 *
 * None of the schemas here are nullable, so a null parse never means the model
 * correctly answered null.
 */
describe('a null structured parse', () => {
	const schema = z.object({ reply: z.string() });
	const structuredOutput: StructuredOutputConfig = {
		name: 'personal_agent_chat_capable',
		schema
	};
	const messages: ChatMessage[] = [{ role: 'user', content: 'hi' }];

	beforeEach(async () => {
		await llmCache.clear();
		vi.clearAllMocks();
	});

	it("fails the call instead of returning the string 'null'", async () => {
		mockGeminiStructuredInvoke.mockResolvedValue({
			raw: new AIMessage({
				content: '',
				usage_metadata: {
					input_tokens: 17496,
					output_tokens: 1783,
					total_tokens: 19279
				}
			}),
			parsed: null
		});

		await expect(
			generateChatCompletion(messages, {
				structuredOutput,
				provider: 'gemini',
				model: 'gemini-2.5-pro'
			})
		).rejects.toThrow(/no usable structured output/i);
	});

	it('carries the tokens the failed call really spent', async () => {
		// The provider bills a failed structured call exactly like a successful
		// one, and the caller's error path is the only place left that can record
		// it — the usual save happens after a return that never comes.
		mockGeminiStructuredInvoke.mockResolvedValue({
			raw: new AIMessage({
				content: '',
				usage_metadata: {
					input_tokens: 17496,
					output_tokens: 1783,
					total_tokens: 19279
				}
			}),
			parsed: null
		});

		const err = await generateChatCompletion(messages, {
			structuredOutput,
			provider: 'gemini',
			model: 'gemini-2.5-pro'
		}).catch((e) => e);

		expect(err.usage).toMatchObject({
			inputTokens: 17496,
			outputTokens: 1783
		});
	});

	it('names the finish reason, because that is the whole diagnosis', async () => {
		// The message is all the log line and `ai_chats.error` will ever carry.
		// MAX_TOKENS with a small output count looks like a contradiction and is
		// not: Gemini's thinking tokens are charged against the same cap and
		// appear in neither `output_tokens` nor anywhere else. Without this in the
		// message, diagnosing it took a replay harness and nine calls.
		mockGeminiStructuredInvoke.mockResolvedValue({
			raw: new AIMessage({
				content: '{"reply": "I can do that. I have prepared two propos',
				response_metadata: { finishReason: 'MAX_TOKENS' },
				usage_metadata: {
					input_tokens: 18022,
					output_tokens: 958,
					total_tokens: 26199
				}
			}),
			parsed: null
		});

		const err = await generateChatCompletion(messages, {
			structuredOutput,
			provider: 'gemini',
			model: 'gemini-2.5-pro'
		}).catch((e) => e);

		expect(err.message).toMatch(/finish reason: MAX_TOKENS/);
		expect(err.message).toMatch(/958 output tokens/);
	});

	it('says so when the provider gave no finish reason at all', async () => {
		mockGeminiStructuredInvoke.mockResolvedValue({
			raw: new AIMessage({
				content: '',
				usage_metadata: { input_tokens: 10, output_tokens: 0, total_tokens: 10 }
			}),
			parsed: null
		});

		const err = await generateChatCompletion(messages, {
			structuredOutput,
			provider: 'gemini',
			model: 'gemini-2.5-pro'
		}).catch((e) => e);

		expect(err.message).toMatch(/finish reason: unknown/);
	});

	it('still returns a valid parse untouched', async () => {
		mockGeminiStructuredInvoke.mockResolvedValue({
			raw: new AIMessage({
				content: '',
				usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
			}),
			parsed: { reply: 'Here you go.' }
		});

		// With structuredOutput, this overload resolves to the parsed object.
		const result = await generateChatCompletion(messages, {
			structuredOutput,
			provider: 'gemini',
			model: 'gemini-2.5-pro'
		});
		expect(result).toEqual({ reply: 'Here you go.' });
	});
});
