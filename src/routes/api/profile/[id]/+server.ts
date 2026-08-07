import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, eq, ne } from 'drizzle-orm';
import { profiles } from '$lib/server/db/schema';
import { buildUpdateData, parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { parseBody, profileUpdateSchema } from '$lib/server/validation/api-schemas';

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

	const updateData = buildUpdateData(data, [
		'name',
		'slug',
		'title',
		'subtitle',
		'headline',
		'summary',
		'email_address',
		'phone_number',
		'personal_website',
		'location',
		'location_url',
		'location_timezone',
		'linkedin_profile',
		'github_profile',
		'stackoverflow_profile',
		'npm_profile',
		'pypi_profile',
		'country_code',
		'browser_language',
		'browser_timezone',
		'browser_country_code'
	]);

	await db.update(profiles).set(updateData).where(eq(profiles.id, profileId));

	return json({ success: true });
};
