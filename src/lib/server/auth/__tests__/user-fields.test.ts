/**
 * No user field is writable through better-auth's own endpoints.
 *
 * better-auth defaults a field to `input: true`, so a field added here without
 * saying otherwise is one a signed-in user can set on themselves through
 * `/update-user`. That is how `is_admin` was open to every session until
 * 2026-11-13. A new field that really is the user's to set should live
 * somewhere this rule does not apply, not get an exemption.
 */
import { describe, expect, it } from 'vitest';
import { userAdditionalFields } from '../user-fields';

describe('userAdditionalFields', () => {
	it.each(Object.keys(userAdditionalFields))('%s is not writable as input', (name) => {
		const field = userAdditionalFields[name as keyof typeof userAdditionalFields];
		expect(field.input).toBe(false);
	});
});
