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

// Mock Redis globally.
//
// The LLM response cache reads and writes Redis on a path most of this suite
// touches, and oss CI has no Redis service. Without a stand-in the suite would
// not merely fail, it would hang: ioredis holds commands in an offline queue
// when the server is unreachable instead of rejecting them.
vi.mock('ioredis', async () => {
	const { FakeRedis } = await import('./src/lib/test-utils/fake-redis');
	return { default: FakeRedis, Redis: FakeRedis };
});

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
