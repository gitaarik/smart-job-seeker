import { describe, expect, test, vi } from 'vitest';

vi.mock('$lib/server/auth/turnstile', () => ({
	turnstileConfigured: () => true,
	turnstileSiteKey: () => 'site-key'
}));

import { gatesContact, withoutContact } from './portfolio-contact';

describe('withoutContact', () => {
	test('nulls the email and phone, and says there is something behind the gate', () => {
		const { profile, contact } = withoutContact({
			name: 'Alex',
			email_address: 'alex@example.com',
			phone_number: '+31 6 1234'
		});
		expect(profile).toEqual({ name: 'Alex', email_address: null, phone_number: null });
		expect(JSON.stringify(profile)).not.toContain('alex@example.com');
		expect(contact).toEqual({ available: true, siteKey: 'site-key' });
	});

	test('no details, no button', () => {
		expect(withoutContact({ email_address: null, phone_number: '' }).contact.available).toBe(false);
	});
});

describe('gatesContact', () => {
	test('only a showcase theme gates', () => {
		const theme = (config: object) => ({ id: 1, name: 't', slug: 't', config });
		expect(gatesContact(theme({ layout: 'showcase' }))).toBe(true);
		expect(gatesContact(theme({}))).toBe(false);
		expect(gatesContact(null)).toBe(false);
	});
});
