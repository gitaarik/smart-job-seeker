/**
 * What the model wrapper does with a structured reply that is the schema's
 * type names instead of an answer (llm/schema-echo.ts).
 *
 * The one that made this necessary, `{"feedback":"string","text":"string"}`,
 * satisfied its schema, so it was returned as a success, saved as the
 * applicant's answer and cached, and asking again brought the same reply back.
 * It was a bad draw: the same request answered properly on three replays. So
 * the wrapper now treats it as a failed attempt, which is retried, handed to the
 * fallback after that, and never cached.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIMessage } from '@langchain/core/messages';
import { z } from 'zod';

vi.mock('$lib/tools/get-env', () => ({
	getEnv: vi.fn(() => 'test-api-key')
}));

// The real three attempts, with the backoff shrunk so a retry costs no wall clock.
vi.mock('../config', () => ({
	config: {
		groqApiKey: 'test-groq-key',
		geminiApiKey: 'test-gemini-key',
		retryMaxAttempts: 3,
		retryInitialDelay: 1,
		retryMaxDelay: 2,
		llmCacheTTL: 3600000,
		llmProvider: 'groq',
		llmModel: 'openai/gpt-oss-120b'
	}
}));

const { mockGroqInvoke, mockGeminiStructuredInvoke } = vi.hoisted(() => ({
	mockGroqInvoke: vi.fn(),
	mockGeminiStructuredInvoke: vi.fn()
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
		withStructuredOutput() {
			return { invoke: (messages: unknown) => mockGeminiStructuredInvoke(messages) };
		}
	}
}));

import { generateChatCompletionTracked } from '../llm';
import { llmCache } from '../llm/cache';
import { LLMOutputValidationError } from '../llm/langchain';

const answerSchema = z.object({ feedback: z.string().optional(), text: z.string() });
const WRITING = {
	provider: 'gemini',
	model: 'gemini-2.5-pro',
	structuredOutput: { name: 'answer_application_question', schema: answerSchema }
};
const ask = [{ role: 'user' as const, content: 'Write my answer to the question above.' }];

/** A Gemini structured reply, with what the call cost. */
function gemini(parsed: unknown) {
	return {
		raw: new AIMessage({
			content: JSON.stringify(parsed),
			usage_metadata: { input_tokens: 20270, output_tokens: 17, total_tokens: 23342 }
		}),
		parsed
	};
}

const ECHO = { feedback: 'string', text: 'string' };
const ANSWER = { feedback: 'I drew on your Acme work.', text: 'Since August 2025 I have…' };

describe('a reply that echoes the schema', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		await llmCache.clear();
	});

	it('is asked again, and the next draw is what comes back', async () => {
		mockGeminiStructuredInvoke
			.mockResolvedValueOnce(gemini(ECHO))
			.mockResolvedValueOnce(gemini(ANSWER));

		const result = await generateChatCompletionTracked(ask, WRITING);

		expect(JSON.parse(result.content)).toEqual(ANSWER);
		expect(mockGeminiStructuredInvoke).toHaveBeenCalledTimes(2);
	});

	it('fails as output validation, with the tokens it cost, when every attempt echoes', async () => {
		mockGeminiStructuredInvoke.mockResolvedValue(gemini(ECHO));

		const error = await generateChatCompletionTracked(ask, WRITING).catch((e) => e);

		expect(error).toBeInstanceOf(LLMOutputValidationError);
		expect(error.message).toMatch(/answer_application_question: gemini echoed the schema/);
		expect(error.message).toContain('{"feedback":"string","text":"string"}');
		expect(error.usage).toMatchObject({ inputTokens: 20270, outputTokens: 17 });
		expect(mockGeminiStructuredInvoke).toHaveBeenCalledTimes(3);
	});

	// What turned one bad draw into a page stuck on it: the retry came from here.
	it('is never cached, so asking again reaches the model', async () => {
		mockGeminiStructuredInvoke.mockResolvedValue(gemini(ECHO));
		await expect(generateChatCompletionTracked(ask, WRITING)).rejects.toThrow();

		mockGeminiStructuredInvoke.mockReset().mockResolvedValue(gemini(ANSWER));
		const result = await generateChatCompletionTracked(ask, WRITING);

		expect(JSON.parse(result.content)).toEqual(ANSWER);
		expect(mockGeminiStructuredInvoke).toHaveBeenCalledTimes(1);
	});

	it('goes to the fallback once the primary has echoed on every attempt', async () => {
		mockGeminiStructuredInvoke.mockResolvedValue(gemini(ECHO));
		mockGroqInvoke.mockResolvedValueOnce(new AIMessage(JSON.stringify(ANSWER)));

		const result = await generateChatCompletionTracked(ask, {
			...WRITING,
			fallback: { provider: 'groq', model: 'openai/gpt-oss-120b' }
		});

		expect(JSON.parse(result.content)).toEqual(ANSWER);
		expect(result.fallbackUsed).toEqual({ provider: 'groq', model: 'openai/gpt-oss-120b' });
	});

	// Groq and Cerebras take the JSON-mode path, which parses the reply itself.
	it('is caught on the JSON-mode path as well', async () => {
		mockGroqInvoke
			.mockResolvedValueOnce(new AIMessage('{"reply":"string"}'))
			.mockResolvedValueOnce(new AIMessage('{"reply":"Hi."}'));

		const result = await generateChatCompletionTracked(ask, {
			structuredOutput: { name: 'personal_agent_chat', schema: z.object({ reply: z.string() }) }
		});

		expect(JSON.parse(result.content)).toEqual({ reply: 'Hi.' });
		expect(mockGroqInvoke).toHaveBeenCalledTimes(2);
	});

	// There is no schema to echo without structured output, and the word can be
	// a real answer: the translation of "string", say.
	it('leaves a plain-text reply of the word alone', async () => {
		mockGroqInvoke.mockResolvedValueOnce(new AIMessage('string'));

		const result = await generateChatCompletionTracked(ask);

		expect(result.content).toBe('string');
		expect(mockGroqInvoke).toHaveBeenCalledTimes(1);
	});
});
