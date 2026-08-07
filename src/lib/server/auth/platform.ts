/**
 * Platform authentication utilities.
 *
 * Credentials are user-wide (`platform_credentials`); per-profile login
 * state lives on `platform_profiles`. The scraper resolves the credential
 * inline via the task's `platform_profile_id → platform_credential_id`
 * chain, so we don't need a public credential-lookup helper here. Only the
 * login-error persistence helper has external callers.
 */

import { dbDirect } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { platform_profiles } from '$lib/server/db/schema';

/**
 * Persist a login error on the per-profile state row. If no
 * platform_profiles row exists yet (first login attempt for this profile),
 * skips silently — the error is also surfaced via the run's logs.
 */
export async function updateLoginError(
	profileId: number,
	platformId: number,
	error: string
): Promise<void> {
	const existing = await dbDirect.query.platform_profiles.findFirst({
		where: and(
			eq(platform_profiles.profile_id, profileId),
			eq(platform_profiles.platform_id, platformId)
		)
	});

	if (existing) {
		await dbDirect
			.update(platform_profiles)
			.set({
				login_error: error
			})
			.where(eq(platform_profiles.id, existing.id));
	}
}
