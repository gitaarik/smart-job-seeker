import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { profile_template_overrides } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { getSelectedProfileId } from '$lib/server/profile/selected-profile';
import { isEntityOwned } from '$lib/server/profile/translations';
import { isTemplateOwned } from '$lib/server/profile/resume-templates';
import { touchProfile } from '$lib/server/profile/touch-profile';
import { isOverridable } from '$lib/template-overrides';
import { BASE_LOCALE, isKnownLocale } from '$lib/resume-translations';

/**
 * Upsert one field's per-template override, or delete it when emptied.
 *
 * Emptying deletes rather than storing "" so the table stays a sparse diff and
 * the field falls back to the profile's own value — the same rule the
 * translations endpoint follows, and the reason neither needs a "use my own
 * value" sentinel.
 */
export const PUT: RequestHandler = async ({ locals, cookies, request }) => {
	const user = requireAuth(locals);
	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) error(400, 'No profile selected');

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'Invalid body');

	const entity = String(body.entity ?? '');
	const field = String(body.field ?? '');
	const locale = String(body.locale ?? BASE_LOCALE);
	const id = Number(body.id);
	const templateId = Number(body.templateId);
	const value = typeof body.value === 'string' ? body.value.trim() : '';

	if (!Number.isInteger(id)) error(400, 'Invalid id');
	if (!Number.isInteger(templateId)) error(400, 'Invalid template');
	if (!isOverridable(entity, field)) error(400, 'Field cannot be overridden per template');
	// The base locale is valid here, unlike in translations: an override is
	// written in the document's own language first and translated after.
	if (!isKnownLocale(locale)) error(400, 'Invalid language');

	// Both ids come from the client, so both are confirmed against this profile
	// before anything is stored — otherwise one user could write overrides onto
	// another's template, and the render path reads them back by template alone.
	if (!(await isTemplateOwned(profileId, templateId))) error(403, 'Access denied');
	if (!(await isEntityOwned(entity, id, profileId))) error(403, 'Access denied');

	const now = new Date();
	if (value) {
		await db
			.insert(profile_template_overrides)
			.values({
				template_id: templateId,
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
					profile_template_overrides.template_id,
					profile_template_overrides.entity_type,
					profile_template_overrides.entity_id,
					profile_template_overrides.field,
					profile_template_overrides.locale
				],
				set: { value, date_updated: now }
			});
	} else {
		await db
			.delete(profile_template_overrides)
			.where(
				and(
					eq(profile_template_overrides.template_id, templateId),
					eq(profile_template_overrides.entity_type, entity),
					eq(profile_template_overrides.entity_id, id),
					eq(profile_template_overrides.field, field),
					eq(profile_template_overrides.locale, locale)
				)
			);
	}

	await touchProfile(profileId);
	return json({ success: true, deleted: !value });
};
