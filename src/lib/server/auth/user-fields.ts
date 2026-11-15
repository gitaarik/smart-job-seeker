/**
 * The columns better-auth adds to its user, and how it may write them.
 *
 * Every field here is `input: false`, and that is the security boundary.
 * better-auth's default is `input: true`, which lets a signed-in user
 * set the field through `/update-user` (and a stranger through
 * `/sign-up/email`): until 2026-11-13 any session, a demo link's included,
 * could POST `{"is_admin": true}` and be an admin. Our own code sets these
 * columns with direct updates, never through better-auth's input, so
 * nothing legitimate needs it. With `input: false` a create quietly takes
 * the default and an update that tries is refused.
 *
 * Kept out of `better-auth.ts` so a test can hold every field to that rule
 * without standing up an auth instance.
 */
export const userAdditionalFields = {
	is_admin: {
		type: 'boolean',
		defaultValue: false,
		input: false
	},
	is_staff: {
		type: 'boolean',
		defaultValue: false,
		input: false
	},
	is_approved: {
		type: 'boolean',
		defaultValue: false,
		input: false
	},
	is_demo: {
		type: 'boolean',
		defaultValue: false,
		input: false
	},
	// Exposed on the session so the auth gates can refuse an account that
	// has asked to be erased without a second query on every request. See
	// $lib/server/account/delete.
	deletion_requested_at: {
		type: 'date',
		required: false,
		input: false
	},
	// The same, for an account an admin has suspended. See
	// $lib/server/account/suspend.
	suspended_at: {
		type: 'date',
		required: false,
		input: false
	},
	// Set by the user-create hook from the signup's terms header, never from
	// the body. See signupTermsFields in signup-gate.ts.
	terms_version: {
		type: 'string',
		required: false,
		input: false
	},
	terms_accepted_at: {
		type: 'date',
		required: false,
		input: false
	}
} as const;
