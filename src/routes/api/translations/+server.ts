import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { profile_translations } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { getSelectedProfileId } from '$lib/server/profile/selected-profile';
import { isEntityOwned } from '$lib/server/profile/translations';
import { touchProfile } from '$lib/server/profile/touch-profile';
import { BASE_LOCALE, isKnownLocale, isTranslatable } from '$lib/resume-translations';

/** All translation overlays for the caller's selected profile. */
export const GET: RequestHandler = async ({ locals, cookies }) => {
	const user = requireAuth(locals);
	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) error(400, 'No profile selected');

	const rows = await db
		.select({
			entity_type: profile_translations.entity_type,
			entity_id: profile_translations.entity_id,
			field: profile_translations.field,
			locale: profile_translations.locale,
			value: profile_translations.value
		})
		.from(profile_translations)
		.where(eq(profile_translations.profile_id, profileId));

	return json({ translations: rows });
};

/** Upsert one field's translation, or delete it when the value is emptied. */
export const PUT: RequestHandler = async ({ locals, cookies, request }) => {
	const user = requireAuth(locals);
	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) error(400, 'No profile selected');

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'Invalid body');

	const entity = String(body.entity ?? '');
	const field = String(body.field ?? '');
	const locale = String(body.locale ?? '');
	const id = Number(body.id);
	const value = typeof body.value === 'string' ? body.value.trim() : '';

	if (!Number.isInteger(id)) error(400, 'Invalid id');
	if (!isTranslatable(entity, field)) error(400, 'Field is not translatable');
	if (!isKnownLocale(locale) || locale === BASE_LOCALE) {
		error(400, 'Invalid language');
	}

	// The entity id comes from the client — confirm it belongs to this profile
	// before writing, or a user could overwrite another profile's translation.
	if (!(await isEntityOwned(entity, id, profileId))) {
		error(403, 'Access denied');
	}

	const now = new Date();
	if (value) {
		await db
			.insert(profile_translations)
			.values({
				profile_id: profileId,
				entity_type: entity,
				entity_id: id,
				field,
				locale,
				value,
				date_created: now,
				date_updated: now
			})
			.onConflictDoUpdate({
				target: [
					profile_translations.profile_id,
					profile_translations.entity_type,
					profile_translations.entity_id,
					profile_translations.field,
					profile_translations.locale
				],
				set: { value, date_updated: now }
			});
	} else {
		await db
			.delete(profile_translations)
			.where(
				and(
					eq(profile_translations.profile_id, profileId),
					eq(profile_translations.entity_type, entity),
					eq(profile_translations.entity_id, id),
					eq(profile_translations.field, field),
					eq(profile_translations.locale, locale)
				)
			);
	}

	await touchProfile(profileId);
	return json({ success: true, deleted: !value });
};
