import crypto from 'crypto';

/**
 * Generate a random token string (lowercase alphanumeric)
 * @param length Length of the token (default: 10)
 * @returns Random token string
 */
export function generateToken(length: number = 10): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	const randomBytes = crypto.randomBytes(length);
	return Array.from(randomBytes)
		.map((byte) => chars[byte % chars.length])
		.join('');
}

/**
 * Hash token for storage using SHA-256
 * @param token The token string to hash
 * @returns SHA-256 hash of the token
 */
export function hashToken(token: string): string {
	return crypto.createHash('sha256').update(token).digest('hex');
}
