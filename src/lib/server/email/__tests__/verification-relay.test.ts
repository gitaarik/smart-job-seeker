import { describe, expect, it } from 'vitest';
import { extractTokenFromRecipient } from '../verification-relay';

describe('extractTokenFromRecipient', () => {
	it('extracts token from valid recipient', () => {
		const token = extractTokenFromRecipient('verify-abc123def456@verify.smartjobseeker.com');
		expect(token).toBe('abc123def456');
	});

	it('extracts 32-char hex token', () => {
		const token = extractTokenFromRecipient(
			'verify-a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4@verify.smartjobseeker.com'
		);
		expect(token).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');
	});

	it('returns null for non-verify address', () => {
		const token = extractTokenFromRecipient('user@smartjobseeker.com');
		expect(token).toBeNull();
	});

	it('returns null for empty string', () => {
		const token = extractTokenFromRecipient('');
		expect(token).toBeNull();
	});

	it('returns null for malformed address', () => {
		const token = extractTokenFromRecipient('verify-@verify.smartjobseeker.com');
		expect(token).toBeNull();
	});

	it('handles uppercase addresses', () => {
		const token = extractTokenFromRecipient('Verify-ABC123@verify.smartjobseeker.com');
		expect(token).toBe('ABC123');
	});
});
