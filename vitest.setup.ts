import { vi } from 'vitest';

// Mock environment variables globally
vi.mock('$lib/tools/get-env', () => ({
	getEnv: vi.fn((key: string, defaultValue = '') => {
		const envVars: Record<string, string> = {
			SJS_WEBHOOK_SECRET: 'test-webhook-secret-key-1234567890123456',
			SJS_DATABASE_URL: 'postgresql://test:test@localhost/test',
			SJS_POSTGRES_URL: 'postgresql://test:test@localhost/test',
			// 32 bytes of hex, so auth/crypto.ts can actually encrypt in tests
			// rather than throwing on a missing key. Obviously fake on sight.
			SJS_CREDENTIALS_KEY: 'dead'.repeat(16)
		};
		return envVars[key] ?? defaultValue;
	})
}));

// Mock the database module globally
vi.mock('$lib/server/db', () => ({
	db: {
		ai_chats: {
			update: vi.fn(),
			findUnique: vi.fn()
		}
	},
	dbDirect: {
		ai_chats: {
			update: vi.fn(),
			findUnique: vi.fn()
		}
	}
}));
