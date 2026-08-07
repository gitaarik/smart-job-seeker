import { describe, expect, it } from 'vitest';
import { generateToken, hashToken } from '../token-generator';

describe('generateToken', () => {
	it('generates token of default length', () => {
		const token = generateToken();
		expect(token).toHaveLength(10);
		expect(token).toMatch(/^[a-z0-9]+$/);
	});

	it('generates token of custom length', () => {
		const token = generateToken(20);
		expect(token).toHaveLength(20);
		expect(token).toMatch(/^[a-z0-9]+$/);
	});

	it('generates unique tokens', () => {
		const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
		expect(tokens.size).toBe(100);
	});
});

describe('hashToken', () => {
	it('produces consistent hash for same input', () => {
		const hash1 = hashToken('test-token');
		const hash2 = hashToken('test-token');
		expect(hash1).toBe(hash2);
	});

	it('produces different hashes for different inputs', () => {
		const hash1 = hashToken('token-a');
		const hash2 = hashToken('token-b');
		expect(hash1).not.toBe(hash2);
	});

	it('returns a 64-char hex string (SHA-256)', () => {
		const hash = hashToken('test');
		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[a-f0-9]+$/);
	});
});
