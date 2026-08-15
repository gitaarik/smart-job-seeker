import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { getSelectedProfileId } from '../../profile/utils';
import { describeProposalChanges } from '$lib/server/ai-chat/capabilities';
import { readEditLog, revertEdit } from '$lib/server/ai-chat/edit-log';
import { PROFILE_RESOURCES, type ProfileResourceName } from '$lib/server/profile/resources';

/**
 * Where an entry of a given kind can be put right by hand.
 *
 * The feed's answer to a change it cannot undo. An `add_*` has no revert — the
 * registry has no delete, on purpose — so the honest response is the same one
 * the assistant gives for a section it cannot reach from a page: name the page
 * and send them there.
 */
function pageFor(capability: string): string | null {
	const resource = capability.slice(capability.indexOf('_') + 1) as ProfileResourceName;
	return PROFILE_RESOURCES[resource]?.page.name ?? null;
}

export const load: PageServerLoad = async ({ parent }) => {
	const { selectedProfile } = await parent();
	if (!selectedProfile) redirect(302, '/home');

	const entries = await readEditLog(selectedProfile.id);

	return {
		entries: entries.map((entry) => ({
			id: entry.id,
			title: entry.title,
			source: entry.source,
			target: entry.target,
			createdAt: entry.createdAt,
			revertedAt: entry.revertedAt,
			revertible: entry.revertible,
			whereInstead: entry.revertible ? null : pageFor(entry.capability),
			// Rendered server-side through the same describer the proposal card
			// uses, so a change reads the same in the feed as it did on the card
			// it was accepted from. `previous` is the before-image the write
			// recorded, which is what makes an applied change reviewable at all.
			changes: describeProposalChanges(entry.capability, entry.fields, entry.previous)
		}))
	};
};

export const actions: Actions = {
	// A form action gets no parent() — the profile comes from the cookie, the
	// same way every other action in this section resolves it.
	revert: async ({ request, cookies, locals }) => {
		const user = locals.user as { id: string; is_staff?: boolean; is_admin?: boolean } | undefined;
		if (!user) return fail(401, { error: 'Not signed in.' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected.' });

		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!Number.isInteger(id) || id <= 0) return fail(400, { error: 'Invalid change.' });

		const outcome = await revertEdit(id, {
			profileId,
			isStaff: !!user.is_staff || !!user.is_admin
		});

		if (!outcome.ok) {
			return fail(outcome.reason === 'not_found' ? 404 : 409, { error: outcome.error });
		}
		return { reverted: id };
	}
};
