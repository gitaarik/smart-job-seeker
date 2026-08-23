/**
 * Tests for the signed upload grant.
 *
 * This is the whole of what stands between a URL and a write, so the cases that
 * matter are the ones where it must say no: a payload edited after signing, a
 * signature borrowed from a different grant, and a link that has simply been
 * lying around too long.
 */
import { describe, expect, it } from 'vitest';
import { GRANT_MAX_AGE_MS, signUploadGrant, verifyUploadGrant } from '../upload-grants';

const GRANT = { profileId: 1, applicationId: 57, recordId: 73 };
const NOW = 1_760_000_000_000;

describe('signUploadGrant / verifyUploadGrant', () => {
	it('round-trips everything the endpoint needs', () => {
		const token = signUploadGrant(GRANT, 'contract.pdf', NOW);

		expect(verifyUploadGrant(token, NOW + 1000)).toEqual({
			...GRANT,
			filename: 'contract.pdf'
		});
	});

	it('keeps a filename containing colons intact', () => {
		// The payload is colon-delimited and the filename is last, so it is the one
		// field that can contain the delimiter. Rik's own scans are named this way
		// ("7:42:24 PM"), so this is the realistic case rather than the clever one.
		const name = 'Annotate v3 (6_25_2026 7:42:24 PM).html';
		const token = signUploadGrant(GRANT, name, NOW);

		expect(verifyUploadGrant(token, NOW)?.filename).toBe(name);
	});

	it('refuses a payload edited after signing', () => {
		const token = signUploadGrant(GRANT, 'contract.pdf', NOW);
		const [encoded, signature] = token.split('.');

		// Repoint it at another profile's entry, keeping the signature.
		const tampered = Buffer.from(encoded, 'base64url').toString('utf8').replace(':1:', ':2:');
		const forged = `${Buffer.from(tampered).toString('base64url')}.${signature}`;

		expect(verifyUploadGrant(forged, NOW)).toBeNull();
	});

	it('refuses a signature from a different grant', () => {
		const mine = signUploadGrant(GRANT, 'contract.pdf', NOW);
		const theirs = signUploadGrant({ ...GRANT, recordId: 99 }, 'contract.pdf', NOW);

		const spliced = `${mine.split('.')[0]}.${theirs.split('.')[1]}`;
		expect(verifyUploadGrant(spliced, NOW)).toBeNull();
	});

	it('expires', () => {
		const token = signUploadGrant(GRANT, 'contract.pdf', NOW);

		expect(verifyUploadGrant(token, NOW + GRANT_MAX_AGE_MS - 1)).not.toBeNull();
		expect(verifyUploadGrant(token, NOW + GRANT_MAX_AGE_MS + 1)).toBeNull();
	});

	it('refuses one issued in the future', () => {
		// A clock that has gone backwards would otherwise make a grant that lives
		// far longer than its stated window.
		const token = signUploadGrant(GRANT, 'contract.pdf', NOW + 60_000);

		expect(verifyUploadGrant(token, NOW)).toBeNull();
	});

	it('refuses malformed tokens rather than throwing', () => {
		for (const bad of ['', '.', 'nodot', 'a.b', '$$$.$$$', 'a.']) {
			expect(() => verifyUploadGrant(bad, NOW)).not.toThrow();
			expect(verifyUploadGrant(bad, NOW)).toBeNull();
		}
	});

	it('refuses a well-signed grant that names nothing', () => {
		// Not reachable through signUploadGrant, which is the point: verify must
		// stand on its own, because the only thing it can assume is the signature.
		const payload = `${NOW}:1:57:73:`;
		const token = `${Buffer.from(payload).toString('base64url')}.${
			signUploadGrant({ profileId: 1, applicationId: 57, recordId: 73 }, '', NOW).split('.')[1]
		}`;

		expect(verifyUploadGrant(token, NOW)).toBeNull();
	});
});
