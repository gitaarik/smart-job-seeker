import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { users } from '$lib/server/db/schema';
import { acceptDeviceInvite, getDeviceInvite } from '$lib/server/device-shares';
import { createOrLinkAccount } from '$lib/server/auth/invite-account';

export const load: PageServerLoad = async (event) => {
	const token = event.params.token;
	const invite = await getDeviceInvite(token);

	if (!invite) {
		return {
			valid: false as const,
			error: 'This invite link is invalid or has expired.'
		};
	}

	return {
		valid: true as const,
		inviterName: invite.inviterName,
		deviceName: invite.deviceName,
		loggedIn: !!event.locals.user
	};
};

export const actions: Actions = {
	default: async (event) => {
		const token = event.params.token;

		// Logged-in users accept in one tap — no account step.
		if (event.locals.user) {
			const result = await acceptDeviceInvite(token, event.locals.user.id);
			if (!result.success) {
				return fail(400, { error: result.error });
			}
			redirect(303, '/jobs/import/devices');
		}

		// Logged-out: create a NEW account, then accept.
		const formData = await event.request.formData();
		const email = (formData.get('email') as string | null)?.trim() ?? '';
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirm_password') as string;

		if (!email || !email.includes('@')) {
			return fail(400, { error: 'A valid email is required' });
		}
		if (!password || password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters' });
		}
		if (password !== confirmPassword) {
			return fail(400, { error: 'Passwords do not match' });
		}

		// Validate the invite up front so we don't create an account for a dead link.
		const invite = await getDeviceInvite(token);
		if (!invite) {
			return fail(400, {
				error: 'This invite link is invalid or has expired.'
			});
		}

		// SECURITY: never re-key an existing account from a device invite — the
		// email here is supplied by whoever opened the link, so re-keying would be
		// account takeover. Existing users must log in and accept while signed in.
		const existing = await db.query.users.findFirst({
			where: eq(users.email, email),
			columns: { id: true }
		});
		if (existing) {
			return fail(400, {
				error:
					'An account with that email already exists. Please log in first, then open this link again to accept.'
			});
		}

		let userId: string;
		try {
			// The host's invite is the approval in the shared-device model, so the
			// new account is approved immediately (no admin gate, no staff/admin).
			({ userId } = await createOrLinkAccount({
				email,
				password,
				flags: { is_approved: true }
			}));
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to create account';
			return fail(400, { error: message });
		}

		const result = await acceptDeviceInvite(token, userId);
		if (!result.success) {
			return fail(400, { error: result.error });
		}

		redirect(302, '/login?invited=1');
	}
};
