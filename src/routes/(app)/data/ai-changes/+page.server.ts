import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { getSelectedProfileId } from '../../profile/utils';
import { describeProposalChanges } from '$lib/server/ai-chat/capabilities';
import { describeLoggedChange, readEditLog, revertEdit } from '$lib/server/ai-chat/edit-log';
import { approveRequest, readRequests, rejectRequest } from '$lib/server/mcp/requests';
import { targetingFor } from '$lib/server/mcp/entities';
import type { Capability } from '$lib/server/ai-chat/capabilities';
import { PROFILE_RESOURCES, type ProfileResourceName } from '$lib/server/profile/resources';

/**
 * Where an entry of a given kind can be put right by hand.
 *
 * The feed's answer to a change it cannot undo. An `add_*` has no revert — the
 * registry has no delete, on purpose — so the honest response is the same one
 * the assistant gives for a section it cannot reach from a page: name the page
 * and send them there.
 *
 * Two registries again, because two things write here: a profile section names
 * its own page, and a job or an application names the list it lives on. Only
 * the second needed adding — `add_activity_record` was the one verb in the feed
 * whose fallback answer was nothing at all.
 */
function pageFor(capability: string): string | null {
	const resource = capability.slice(capability.indexOf('_') + 1) as ProfileResourceName;
	return (
		PROFILE_RESOURCES[resource]?.page.name ??
		targetingFor(capability as Capability)?.collection.name ??
		null
	);
}

export const load: PageServerLoad = async ({ parent }) => {
	const { selectedProfile } = await parent();
	if (!selectedProfile) redirect(302, '/home');

	const [entries, pending] = await Promise.all([
		readEditLog(selectedProfile.id),
		readRequests(selectedProfile.id, ['pending'])
	]);

	// An entry's blocker arrives as an id, and an id is not what the page shows.
	// Resolved here against the same window it was computed over, so the card can
	// say which change to undo first in the words that change is titled with.
	const titles = new Map(entries.map((entry) => [entry.id, entry.title]));

	return {
		// Everything an agent asked for and nobody has answered. First on the page
		// because it is the only part of this feed with anything outstanding — the
		// rest is history, and history can wait.
		pending: pending.map((request) => ({
			id: request.id,
			title: request.title,
			target: request.target,
			createdAt: request.createdAt,
			// The agent's own account of why. Rendered as text and never as markup:
			// it was authored outside this application, by a model that may have been
			// reading a document a stranger wrote.
			rationale: request.rationale,
			changes: describeProposalChanges(request.capability, request.fields, request.previous),
			whereInstead: pageFor(request.capability)
		})),
		entries: entries.map((entry) => ({
			id: entry.id,
			title: entry.title,
			source: entry.source,
			target: entry.target,
			createdAt: entry.createdAt,
			revertedAt: entry.revertedAt,
			revertible: entry.revertible,
			// What the applicant has to undo before this one, named rather than
			// numbered. See the ordering note in edit-log.ts for why undoing out of
			// order lands on a value nobody chose.
			blockedBy:
				entry.supersededBy === null ? null : (titles.get(entry.supersededBy) ?? 'a later change'),
			whereInstead: entry.revertible ? null : pageFor(entry.capability),
			// Rendered server-side through the same describer the proposal card
			// uses where the change was one, and through its own where it was a
			// deletion or a reorder. `previous` is the before-image the write
			// recorded, which is what makes an applied change reviewable at all.
			changes: describeLoggedChange(entry)
		}))
	};
};

/**
 * Whoever is signed in, and which profile they have selected.
 *
 * A form action gets no `parent()`, so the profile comes from the cookie the
 * same way every other action in this section resolves it. Shared by all three
 * actions because the alternative is three copies of an authorization check.
 */
async function actorFor(
	cookies: Parameters<Actions[string]>[0]['cookies'],
	locals: App.Locals
): Promise<{ profileId: number; isStaff: boolean } | { error: string; status: number }> {
	const user = locals.user as { id: string; is_staff?: boolean; is_admin?: boolean } | undefined;
	if (!user) return { error: 'Not signed in.', status: 401 };

	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) return { error: 'No profile selected.', status: 400 };

	return { profileId, isStaff: !!user.is_staff || !!user.is_admin };
}

function idFrom(form: FormData): number | null {
	const id = Number(form.get('id'));
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const actions: Actions = {
	revert: async ({ request, cookies, locals }) => {
		const actor = await actorFor(cookies, locals);
		if ('error' in actor) return fail(actor.status, { error: actor.error });

		const id = idFrom(await request.formData());
		if (id === null) return fail(400, { error: 'Invalid change.' });

		const outcome = await revertEdit(id, actor);
		if (!outcome.ok) {
			return fail(outcome.reason === 'not_found' ? 404 : 409, { error: outcome.error });
		}
		return { reverted: id };
	},

	/**
	 * Do what an agent asked for.
	 *
	 * This is the one place a Tier 2 change becomes a write, and it is reached
	 * through a signed-in session on this application's own origin — never
	 * through the MCP server, which has no tool that approves and must not grow
	 * one. That separation is the whole reason the tier exists: it is what
	 * survives an agent that has been talked into something by text it read.
	 */
	approve: async ({ request, cookies, locals }) => {
		const actor = await actorFor(cookies, locals);
		if ('error' in actor) return fail(actor.status, { error: actor.error });

		const id = idFrom(await request.formData());
		if (id === null) return fail(400, { error: 'Invalid request.' });

		const outcome = await approveRequest(id, actor);
		if (!outcome.ok) {
			return fail(outcome.reason === 'already_decided' ? 409 : 400, { error: outcome.error });
		}
		return { approved: id };
	},

	reject: async ({ request, cookies, locals }) => {
		const actor = await actorFor(cookies, locals);
		if ('error' in actor) return fail(actor.status, { error: actor.error });

		const id = idFrom(await request.formData());
		if (id === null) return fail(400, { error: 'Invalid request.' });

		const outcome = await rejectRequest(id, actor);
		if (!outcome.ok) return fail(409, { error: outcome.error });
		return { rejected: id };
	}
};
