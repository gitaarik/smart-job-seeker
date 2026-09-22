/**
 * The match preferences, over REST, for the config form.
 *
 * Both handlers write through `writeMatchPreferences`, which is also the door
 * `edit_match_config` uses. They used to build the same update object twice
 * here, with the empty-array-to-null rule spelled out in both, and a capability
 * would have made it three times.
 *
 * What still differs between them is policy, not mechanics: PUT is the form
 * saving the whole config and creates the row if there is none; PATCH is a
 * partial change to a config that must already exist.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { match_config, profiles } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { writeMatchPreferences } from '$lib/server/job/match-preferences';
import {
	jobPreferencesPatchSchema,
	jobPreferencesSchema,
	parseBody
} from '$lib/server/validation/api-schemas';

/** The profile is this user's, or there is nothing here to write. */
async function ownsProfile(profileId: number, userId: string): Promise<boolean> {
	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profileId), eq(profiles.user_id, userId)),
		columns: { id: true }
	});
	return !!profile;
}

export const PUT: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);
	const { profile_id, ...fields } = parseBody(jobPreferencesSchema, await request.json());

	if (!(await ownsProfile(profile_id, user.id))) {
		return json({ error: 'Profile not found' }, { status: 404 });
	}

	const result = await writeMatchPreferences(profile_id, fields);
	return json({ success: true, id: result.id });
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);
	const { profile_id, ...fields } = parseBody(jobPreferencesPatchSchema, await request.json());

	if (!(await ownsProfile(profile_id, user.id))) {
		return json({ error: 'Profile not found' }, { status: 404 });
	}

	// A patch names fields on a config that exists. `writeMatchPreferences` would
	// happily create one, which is right for the form and wrong here: a PATCH
	// against nothing is a caller that has lost track of what it is editing.
	const existing = await db.query.match_config.findFirst({
		where: eq(match_config.profile_id, profile_id),
		columns: { id: true }
	});
	if (!existing) {
		return json({ error: 'No match config found. Create one first via PUT.' }, { status: 404 });
	}

	const result = await writeMatchPreferences(profile_id, fields);
	return json({ success: true, id: result.id });
};
