import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import {
	job_platforms,
	platform_credentials,
	platform_profiles,
	profiles,
	search_tasks
} from '$lib/server/db/schema';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { parseBody, platformCredentialsSchema } from '$lib/server/validation/api-schemas';

/**
 * The accounts a user has on a job platform: a username (usually the email
 * address they sign in with) per row, and no secret. The server stopped
 * storing platform passwords and security answers on 2026-11-14 (migration
 * 0111); the user signs in in the browser on their own device, and the
 * username only lets a run type the address on a site that sends a code.
 */

/**
 * GET /api/platforms/[id]/credentials?profileId=X
 *
 * List all accounts the logged-in user has for this platform. Returns
 * user-wide rows (an account is shared across every profile the user owns);
 * the `profileId` query param is retained only for ownership validation — any
 * of the user's profiles surfaces the same list.
 */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const user = requireAuth(locals);
	const platformId = parseIntParam(params.id, 'platform');

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

	// Order latest-added first so callers that auto-pick `credentials[0]`
	// (the add-task form's default-selection logic in SearchTaskFields.svelte)
	// land on the user's most-recent credential rather than whichever
	// happened to come back first from an un-ordered scan. The dropdown still
	// shows every row so the user can override.
	const credentials = await db.query.platform_credentials.findMany({
		where: and(
			eq(platform_credentials.user_id, user.id),
			eq(platform_credentials.platform_id, platformId)
		),
		columns: { id: true, username: true },
		orderBy: desc(platform_credentials.date_created)
	});

	return json(credentials);
};

/**
 * PUT /api/platforms/[id]/credentials
 *
 * Upsert a credential for the logged-in user on this platform. With
 * credentials user-wide, this no longer creates per-profile rows — the
 * credential lives on `platform_credentials`. `profileId` is kept on the
 * input for ownership validation but is not stored on the credential.
 */
export const PUT: RequestHandler = async ({ params, locals, request }) => {
	const user = requireAuth(locals);
	const platformId = parseIntParam(params.id, 'platform');

	const { profileId, credentialId, username } = parseBody(
		platformCredentialsSchema,
		await request.json()
	);

	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profileId), eq(profiles.user_id, user.id))
	});
	if (!profile) {
		throw error(403, 'Not authorized');
	}

	const platform = await db.query.job_platforms.findFirst({
		where: and(eq(job_platforms.id, platformId), eq(job_platforms.status, 'published'))
	});
	if (!platform) {
		throw error(404, 'Platform not found');
	}

	const existing =
		credentialId !== undefined
			? await db.query.platform_credentials.findFirst({
					where: and(
						eq(platform_credentials.id, credentialId),
						eq(platform_credentials.user_id, user.id),
						eq(platform_credentials.platform_id, platformId)
					)
				})
			: null;

	if (credentialId !== undefined && !existing) {
		throw error(404, 'Credential not found');
	}

	if (existing) {
		// Partial-edit semantics: only touch fields the caller explicitly sent.
		const update: Partial<typeof platform_credentials.$inferInsert> = {
			date_updated: new Date()
		};
		if (username !== undefined) update.username = username || null;
		await db
			.update(platform_credentials)
			.set(update)
			.where(eq(platform_credentials.id, existing.id));
		// Clear any login error on this profile's runtime row — the user just
		// changed the account, so the old error is stale.
		await db
			.update(platform_profiles)
			.set({ login_error: null })
			.where(
				and(
					eq(platform_profiles.profile_id, profile.id),
					eq(platform_profiles.platform_credential_id, existing.id)
				)
			);
		return json({ success: true, id: existing.id });
	}

	const [created] = await db
		.insert(platform_credentials)
		.values({
			user_id: user.id,
			platform_id: platformId,
			username: username || null,
			date_created: new Date(),
			date_updated: new Date()
		})
		.returning({ id: platform_credentials.id });

	return json({ success: true, id: created.id });
};

/**
 * DELETE /api/platforms/[id]/credentials
 *
 * Delete one credential (?credentialId=X) or all of the user's
 * credentials for this platform (no credentialId). Search tasks
 * referencing the deleted credentials have their platform_credential_id
 * cleared via the FK ON DELETE SET NULL on platform_profiles.
 */
export const DELETE: RequestHandler = async ({ params, locals, url }) => {
	const user = requireAuth(locals);
	const platformId = parseIntParam(params.id, 'platform');

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

	const credentialIdRaw = url.searchParams.get('credentialId');

	if (credentialIdRaw) {
		const cred = await db.query.platform_credentials.findFirst({
			where: and(
				eq(platform_credentials.id, parseInt(credentialIdRaw)),
				eq(platform_credentials.user_id, user.id),
				eq(platform_credentials.platform_id, platformId)
			)
		});
		if (!cred) {
			throw error(404, 'Credential not found');
		}

		// Find platform_profiles rows that reference this credential so we can
		// null out their FK on search_tasks before deleting.
		const ppRows = await db.query.platform_profiles.findMany({
			where: eq(platform_profiles.platform_credential_id, cred.id),
			columns: { id: true }
		});
		const ppIds = ppRows.map((r) => r.id);
		if (ppIds.length > 0) {
			await db
				.update(search_tasks)
				.set({ platform_profile_id: null })
				.where(inArray(search_tasks.platform_profile_id, ppIds));
		}

		await db.delete(platform_credentials).where(eq(platform_credentials.id, cred.id));
	} else {
		const creds = await db.query.platform_credentials.findMany({
			where: and(
				eq(platform_credentials.user_id, user.id),
				eq(platform_credentials.platform_id, platformId)
			),
			columns: { id: true }
		});
		const credIds = creds.map((c) => c.id);
		if (credIds.length === 0) {
			return json({ success: true });
		}

		const ppRows = await db.query.platform_profiles.findMany({
			where: inArray(platform_profiles.platform_credential_id, credIds),
			columns: { id: true }
		});
		const ppIds = ppRows.map((r) => r.id);
		if (ppIds.length > 0) {
			await db
				.update(search_tasks)
				.set({ platform_profile_id: null })
				.where(inArray(search_tasks.platform_profile_id, ppIds));
		}

		await db.delete(platform_credentials).where(inArray(platform_credentials.id, credIds));
	}

	return json({ success: true });
};
