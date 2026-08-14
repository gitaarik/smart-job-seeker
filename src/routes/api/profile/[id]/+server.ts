import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, eq, ne } from 'drizzle-orm';
import { profiles } from '$lib/server/db/schema';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { coerceFields, type FieldKind } from '$lib/server/utils/field-kinds';
import { parseBody, profileUpdateSchema } from '$lib/server/validation/api-schemas';

/**
 * The profile row's own editable columns.
 *
 * Declared here rather than in `PROFILE_RESOURCES` because the profile is not
 * one of its sections: it has no `status` to hide behind, its owner is
 * `user_id` rather than `profile_id`, and its slug needs canonicalizing and a
 * uniqueness check that nothing else needs. One member with three exceptions is
 * not a member. What it does share is the coercion — there is one of those now,
 * and this goes through it.
 */
const PROFILE_FIELDS: Record<string, FieldKind> = {
	name: 'string',
	slug: 'string',
	title: 'string',
	subtitle: 'string',
	headline: 'string',
	summary: 'string',
	email_address: 'string',
	phone_number: 'string',
	personal_website: 'string',
	location: 'string',
	location_url: 'string',
	location_timezone: 'string',
	linkedin_profile: 'string',
	github_profile: 'string',
	stackoverflow_profile: 'string',
	npm_profile: 'string',
	pypi_profile: 'string',
	country_code: 'string',
	browser_language: 'string',
	browser_timezone: 'string',
	browser_country_code: 'string'
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const profileId = parseIntParam(params.id, 'profile');

	// Verify ownership
	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profileId), eq(profiles.user_id, user.id)),
		columns: { id: true, slug: true }
	});

	if (!profile) {
		error(403, 'Access denied');
	}

	const data: Record<string, unknown> = parseBody(profileUpdateSchema, await request.json());

	// Validate and process slug if provided
	if (data.slug !== undefined && data.slug && (data.slug as string).trim()) {
		const slug = (data.slug as string)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '');

		if (slug.length < 2) {
			error(400, 'Slug must be at least 2 characters');
		}

		if (slug.length > 50) {
			error(400, 'Slug must be 50 characters or less');
		}

		// Check if slug is already taken by another profile
		const existingProfile = await db.query.profiles.findFirst({
			where: and(eq(profiles.slug, slug), ne(profiles.id, profileId))
		});

		if (existingProfile) {
			error(400, 'This URL slug is already taken');
		}

		data.slug = slug;
	}

	const coerced = coerceFields(PROFILE_FIELDS, data);
	if (!coerced.ok) {
		error(400, coerced.error);
	}

	await db
		.update(profiles)
		.set({ ...coerced.values, date_updated: new Date() })
		.where(eq(profiles.id, profileId));

	return json({ success: true });
};
