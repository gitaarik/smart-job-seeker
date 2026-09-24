/**
 * better-auth sends both signup verification and an email change through one
 * hook, passing the new address as `user.email` for a change. These pin which
 * mail each gets: the change mail went unsent for as long as it was set on a
 * better-auth option that no longer existed.
 */
import { describe, expect, it } from 'vitest';
import { verificationMail } from '../verification-email';

const LINK = 'https://example.com/api/auth/verify-email?token=t&callbackURL=%2Fsettings';

describe('verificationMail', () => {
	it('verifies a signup address with the generic mail', () => {
		const mail = verificationMail({ id: 'u1', email: 'ann@example.com' }, LINK, 'ann@example.com');

		expect(mail).toMatchObject({
			to: 'ann@example.com',
			subject: 'Verify your email address',
			type: 'verification',
			userId: 'u1'
		});
	});

	it('names the new address when it differs from the stored one', () => {
		const mail = verificationMail({ id: 'u1', email: 'new@example.com' }, LINK, 'old@example.com');

		expect(mail).toMatchObject({
			to: 'new@example.com',
			subject: 'Verify your new email address',
			type: 'email_change',
			userId: 'u1'
		});
		expect(mail.html).toContain('<strong>new@example.com</strong>');
	});

	it('treats an address that differs only in case as the same one', () => {
		const mail = verificationMail({ id: 'u1', email: 'Ann@Example.com' }, LINK, 'ann@example.com');

		expect(mail.type).toBe('verification');
	});

	it('falls back to the generic mail when there is no stored row', () => {
		expect(verificationMail({ id: 'u1', email: 'ann@example.com' }, LINK, null).type).toBe(
			'verification'
		);
	});

	it('escapes what it puts in the HTML', () => {
		const mail = verificationMail({ id: 'u1', email: 'a<b>@example.com' }, LINK, 'old@example.com');

		expect(mail.html).toContain('a&lt;b&gt;@example.com');
		expect(mail.html).toContain('href="https://example.com/api/auth/verify-email?token=t&amp;');
	});
});
