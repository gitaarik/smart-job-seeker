/**
 * Where an applicant connects an outside agent to their profile — and where the
 * one decision that matters gets made.
 *
 * The scope is chosen here, once, with the consequences written next to it,
 * rather than in a per-call approval prompt inside someone else's client. That
 * is deliberate: a prompt that fires on every call gets clicked through, and the
 * client's "allow always" button is one click away in every one of them. This
 * page is the only surface where the person can see what they are agreeing to
 * before an agent is holding the credential.
 */

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import {
	createMcpKey,
	isMcpReadScope,
	isMcpScope,
	listMcpKeys,
	revokeMcpKey
} from '$lib/server/mcp/keys';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { profiles, selectedProfile } = await parent();
	const user = locals.user as { id: string } | undefined;
	if (!selectedProfile || !user) redirect(302, '/home');

	return {
		// Every key this user holds, not only the selected profile's. A credential
		// they forgot they minted against another profile is exactly the one worth
		// showing them, and hiding it behind a profile switch is how it gets
		// forgotten again.
		keys: await listMcpKeys(user.id),
		profiles: profiles.map((profile) => ({ id: profile.id, name: profile.name })),
		selectedProfileId: selectedProfile.id
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const user = locals.user as { id: string } | undefined;
		if (!user) return fail(401, { error: 'Not signed in.' });

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const scope = String(form.get('scope') ?? '');
		const readScope = String(form.get('read_scope') ?? 'record');
		const profileId = Number(form.get('profile_id'));

		if (!name) return fail(400, { error: 'Give the app a name so you can tell it apart later.' });
		if (!isMcpScope(scope)) return fail(400, { error: 'Pick what the app is allowed to do.' });
		// Refused rather than narrowed to the safe end: this is the moment the
		// decision is made, and silently making a different one is how someone
		// ends up believing they granted less than they did — or more.
		if (!isMcpReadScope(readScope)) return fail(400, { error: 'Pick what the app may see.' });
		if (!Number.isInteger(profileId)) return fail(400, { error: 'Pick a profile.' });

		// `createMcpKey` re-checks the profile against the user rather than
		// trusting this form. This is the moment a credential is bound, and a
		// mistake here binds an agent to the wrong history for as long as the key
		// lives.
		const created = await createMcpKey({ userId: user.id, profileId, name, scope, readScope });
		if (!created) return fail(400, { error: 'That profile is not yours.' });

		// Returned once and never again — the row keeps it encrypted for re-reading
		// on this page, but the moment it is first shown is the one the applicant
		// is actually looking at.
		return { created: { id: created.id, key: created.key, name } };
	},

	revoke: async ({ request, locals }) => {
		const user = locals.user as { id: string } | undefined;
		if (!user) return fail(401, { error: 'Not signed in.' });

		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id)) return fail(400, { error: 'Invalid key.' });

		const revoked = await revokeMcpKey(id, user.id);
		if (!revoked) return fail(404, { error: 'That key is already revoked, or is not yours.' });

		return { revoked: id };
	}
};
