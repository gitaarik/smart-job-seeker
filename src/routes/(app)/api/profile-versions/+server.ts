import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { profile_versions } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { getSelectedProfileId } from '../../profile/utils';

export const GET: RequestHandler = async ({ locals, cookies }) => {
	const user = requireAuth(locals);

	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) {
		return json([]);
	}

	// Library only: these slugs are what a skill can be tagged onto, and a
	// per-job version expresses itself through overrides, not shared tags.
	const versions = await db.query.profile_versions.findMany({
		where: and(eq(profile_versions.profile_id, profileId), isNull(profile_versions.application_id)),
		columns: { slug: true },
		orderBy: desc(profile_versions.date_created)
	});

	return json(versions.map((v) => v.slug).filter(Boolean));
};
