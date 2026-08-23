/**
 * What the assistant can propose on the page the caller is looking at.
 *
 * The same question the prompt answers in prose, asked by the chat panel before
 * there is a prompt at all — so that the empty state can say what this page
 * offers instead of "Ask me anything", which is where the whole discovery
 * problem starts: the write half of this assistant has no surface. Nothing
 * tells a user that a job page will propose a rewrite until they guess it.
 *
 * Resolved through `resolveChatContext`, not through a second reading of
 * ROUTE_SCOPES. A list built here from the declared capabilities would show
 * verbs the user cannot exercise — `authorize` is what decides that, per row,
 * per turn — and a promise the chat then refuses is worse than no promise. What
 * this returns is what a turn sent from this page would actually be able to do.
 *
 * A read, so it costs no credits and writes nothing. It does spend a `current`
 * read per live capability, which is why the client asks once per route while
 * the panel is open and empty rather than on every navigation.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { resolveChatContext } from '$lib/server/ai-chat/chat-context';
import { CAPABILITIES } from '$lib/server/ai-chat/capabilities';
import { isStaffUser, requireConversationProfile } from '../scope';

/**
 * Route params, as JSON, because they are a map and a query string is not.
 *
 * Anything unparseable is treated as no params rather than as an error: the
 * worst case is a page whose entity does not resolve, which returns an empty
 * list — exactly what a page with no capabilities returns, and the empty state
 * degrades to the sentence it had before.
 */
function readParams(raw: string | null): Record<string, string> {
	if (!raw) return {};
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
		return Object.fromEntries(
			Object.entries(parsed as Record<string, unknown>)
				.filter(([, value]) => typeof value === 'string')
				.map(([key, value]) => [key, value as string])
		);
	} catch {
		return {};
	}
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const user = requireAuth(locals);
	const profileId = await requireConversationProfile(url, user.id);

	const { capabilities } = await resolveChatContext({
		routeId: url.searchParams.get('route'),
		params: readParams(url.searchParams.get('params')),
		profileId,
		isStaff: isStaffUser(user),
		// No message: this runs before the user has typed one. The only thing it
		// costs is the section matcher, which narrows a long list to the rows a
		// message named — with nothing named, a page keeps its own capabilities
		// and gains none, which is exactly the list the empty state should show.
		message: ''
	});

	return json({
		success: true,
		// Titles only, deliberately. The obvious extra is a row count, and it
		// would be wrong where it matters: `TARGET_LIST_CAP` bounds a long
		// section's list, so a page holding 93 skills reports 25 and the user
		// reads a limit that is not one.
		here: capabilities.map((live) => ({
			capability: live.capability,
			title: CAPABILITIES[live.capability].title
		}))
	});
};
