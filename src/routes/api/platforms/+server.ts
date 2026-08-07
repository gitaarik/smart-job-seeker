import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, eq, isNotNull } from 'drizzle-orm';
import {
	job_platforms,
	platform_credentials,
	platform_profiles,
	profiles
} from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';

/**
 * GET /api/platforms
 *
 * Lists platforms where the user has credentials configured. Credentials
 * are user-wide; runtime state (status, last_login_at, login_error) comes
 * from the platform_profiles row for the requested profile, joined via
 * platform_credential_id.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requireAuth(locals);

	const profileIdRaw = url.searchParams.get('profileId');
	if (!profileIdRaw) {
		throw error(400, 'Profile ID required');
	}

	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, parseInt(profileIdRaw)), eq(profiles.user_id, user.id))
	});
	if (!profile) {
		throw error(403, 'Not authorized');
	}

	const credentials = await db.query.platform_credentials.findMany({
		where: and(eq(platform_credentials.user_id, user.id), isNotNull(platform_credentials.username)),
		columns: {
			id: true,
			username: true,
			platform_id: true
		}
	});
	if (credentials.length === 0) return json([]);

	// Per-profile runtime state for the picked profile, keyed by credential id.
	const ppRows = await db.query.platform_profiles.findMany({
		where: and(
			eq(platform_profiles.profile_id, profile.id),
			isNotNull(platform_profiles.platform_credential_id)
		),
		columns: {
			platform_credential_id: true,
			status: true,
			last_login_at: true,
			login_error: true
		}
	});
	const runtimeByCredId = new Map(
		ppRows
			.filter((r) => r.platform_credential_id !== null)
			.map((r) => [r.platform_credential_id!, r])
	);

	const platformIds = [...new Set(credentials.map((c) => c.platform_id))];
	const platforms = await db.query.job_platforms.findMany({
		where: (jp, { inArray }) => inArray(jp.id, platformIds),
		columns: {
			id: true,
			name: true,
			key: true,
			url: true,
			login_page_url: true
		}
	});
	const platformById = new Map(platforms.map((p) => [p.id, p]));

	const result = credentials
		.map((c) => {
			const platform = platformById.get(c.platform_id);
			if (!platform) return null;
			const runtime = runtimeByCredId.get(c.id);
			return {
				id: platform.id,
				name: platform.name,
				key: platform.key,
				url: platform.url,
				loginPageUrl: platform.login_page_url,
				hasCredentials: true,
				credentials: {
					id: c.id,
					username: c.username,
					status: runtime?.status ?? null,
					last_login_at: runtime?.last_login_at?.toISOString() ?? null,
					login_error: runtime?.login_error ?? null
				}
			};
		})
		.filter((p): p is NonNullable<typeof p> => p !== null);

	return json(result);
};
