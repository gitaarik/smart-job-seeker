/**
 * Common mock utilities for tests
 * Provides reusable mock functions and configurations
 */

import { vi } from 'vitest';

/**
 * Creates a mock database client with common methods
 * Can be extended with additional methods as needed
 */
export function createMockDb() {
	return {
		profiles: {
			findUnique: vi.fn(),
			findMany: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn()
		},
		ai_chats: {
			findUnique: vi.fn(),
			findMany: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn()
		},
		ai_chat_templates: {
			findUnique: vi.fn(),
			findMany: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn()
		},
		collected_data: {
			findUnique: vi.fn(),
			findMany: vi.fn(),
			findFirst: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn()
		}
	};
}

/**
 * Creates a mock environment variables object for testing
 */
export function createMockEnv(overrides: Record<string, string> = {}): Record<string, string> {
	return {
		SJS_DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
		SJS_POSTGRES_URL: 'postgresql://test:test@localhost:5432/test',
		SJS_APP_URL_HOST: 'http://localhost:5173',
		SJS_LLM_API_KEY_GROQ: 'test-groq-key',
		SJS_TURNSTILE_SECRET: 'test-turnstile-secret',
		...overrides
	};
}

/**
 * Creates a mock Groq SDK client
 */
export function createMockGroqClient() {
	return {
		chat: {
			completions: {
				create: vi.fn()
			}
		}
	};
}

/**
 * Mock response helpers for common API responses
 */
export const mockResponses = {
	success: (message: string, data?: any) => ({
		success: true,
		message,
		...(data && { data })
	}),
	error: (message: string, error?: string) => ({
		success: false,
		message,
		...(error && { error })
	})
};

/**
 * Mock LLM completion response
 */
export function createMockLLMResponse(content: string) {
	return {
		choices: [
			{
				message: {
					content,
					role: 'assistant'
				},
				finish_reason: 'stop',
				index: 0
			}
		],
		model: 'openai/gpt-oss-120b',
		usage: {
			prompt_tokens: 100,
			completion_tokens: 50,
			total_tokens: 150
		}
	};
}

/**
 * Mock fetch response
 */
export function createMockFetchResponse(
	data: any,
	options: { status?: number; ok?: boolean } = {}
) {
	return {
		ok: options.ok !== undefined ? options.ok : true,
		status: options.status || 200,
		json: vi.fn().mockResolvedValue(data),
		text: vi.fn().mockResolvedValue(JSON.stringify(data)),
		headers: new Headers()
	};
}

/**
 * Helper to reset all mocks in a mock database
 */
export function resetMockDb(mockDb: ReturnType<typeof createMockDb>) {
	Object.values(mockDb).forEach((table) => {
		Object.values(table).forEach((method) => {
			if (typeof method === 'function' && 'mockClear' in method) {
				method.mockClear();
			}
		});
	});
}
