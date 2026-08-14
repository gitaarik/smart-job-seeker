/**
 * The reorder endpoint, once.
 *
 * Languages, references and certificates each had their own `+server.ts` for
 * this, and the three files differed only in which table they named — same
 * auth, same schema under three names, same `Promise.all` of scoped updates,
 * same response. They are one handler with a parameter.
 *
 * Two things change in the merge, both of them the other two files agreeing
 * with the rest of the codebase rather than a new decision:
 *
 *  - the write goes through the profile write layer, so a reorder now bumps
 *    `profiles.date_updated` like every other section write. It never did here,
 *    which meant dragging a language into place left the matcher scoring
 *    against a snapshot that predated the change;
 *  - ownership is checked once, against the profile named in the body.
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { profiles } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { parseBody, profileReorderSchema } from '$lib/server/validation/api-schemas';
import { reorderRows } from './write';
import type { ProfileResourceName } from './resources';

export function profileReorderHandler(resource: ProfileResourceName) {
	return async ({ request, locals }: RequestEvent): Promise<Response> => {
		const user = requireAuth(locals);

		const { profile_id, order } = parseBody(profileReorderSchema, await request.json());

		const profile = await db.query.profiles.findFirst({
			where: and(eq(profiles.id, profile_id), eq(profiles.user_id, user.id)),
			columns: { id: true }
		});
		if (!profile) {
			return json({ error: 'Profile not found' }, { status: 404 });
		}

		await reorderRows(resource, { profileId: profile_id }, order);

		return json({ success: true });
	};
}
