/**
 * CRUD for alternative field wordings.
 *
 * These are library rows, not decisions: creating one does not change any
 * document. What a document says is decided by the pick a version makes, which
 * lives at ./pick — so deleting a variant is safe in the sense that the field
 * falls back to the profile's own value everywhere it was picked, and the picks
 * go with it.
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, eq, inArray } from 'drizzle-orm';
import {
	profile_field_variants,
	profile_translations,
	profile_version_overrides
} from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { getSelectedProfileId } from '$lib/server/profile/selected-profile';
import { touchProfile } from '$lib/server/profile/touch-profile';
import { isVariantEntity, isVariantField, FIELD_VARIANT_ENTITY } from '$lib/field-variants';
import { OVERRIDE_ENTITIES } from '$lib/version-overrides';
import {
	createFieldVariant,
	isVariantOwned,
	isVariantTargetOwned,
	listFieldVariants
} from '$lib/server/profile/field-variants';

/**
 * Every variant this profile holds, for the editor.
 *
 * `?entity=work_experience&entityId=10` narrows it to one row's: a role's page
 * edits that role's wordings and has no use for the rest of the list.
 */
export const GET: RequestHandler = async ({ locals, cookies, url }) => {
	const user = requireAuth(locals);
	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) error(400, 'No profile selected');

	const variants = await listFieldVariants(profileId);
	const entity = url.searchParams.get('entity');
	if (!entity) return json({ variants });

	const entityId = Number(url.searchParams.get('entityId'));
	return json({
		variants: variants.filter((v) => v.entity === entity && v.entity_id === entityId)
	});
};

/**
 * Add one alternative wording for a field.
 *
 * `entity` and `entityId` say whose field: a role's, by the role's id. Left
 * out, it is a field of the profile itself, which is all this endpoint took
 * before a role's position could have wordings.
 */
export const POST: RequestHandler = async ({ locals, cookies, request }) => {
	const user = requireAuth(locals);
	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) error(400, 'No profile selected');

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'Invalid body');

	const entity = body.entity == null ? 'profile' : String(body.entity);
	const field = String(body.field ?? '');
	if (!isVariantEntity(entity) || !isVariantField(entity, field)) {
		error(400, 'Field cannot have variants');
	}
	const entityId = entity === 'profile' ? profileId : Number(body.entityId);
	if (!Number.isInteger(entityId)) error(400, 'Invalid id');
	// The id comes from the client, and a variant written onto another
	// profile's role would be offered and printed there.
	if (!(await isVariantTargetOwned(profileId, entity, entityId))) error(403, 'Access denied');

	const value = typeof body.value === 'string' ? body.value.trim() : '';
	if (!value) error(400, 'A variant needs a value');

	const variant = await createFieldVariant({
		profileId,
		entity,
		entityId,
		field,
		label: typeof body.label === 'string' ? body.label : '',
		value,
		note: typeof body.note === 'string' ? body.note : null
	});

	await touchProfile(profileId);
	return json({ success: true, variant });
};

/** Edit one. */
export const PUT: RequestHandler = async ({ locals, cookies, request }) => {
	const user = requireAuth(locals);
	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) error(400, 'No profile selected');

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'Invalid body');

	const id = Number(body.id);
	if (!Number.isInteger(id)) error(400, 'Invalid id');
	if (!(await isVariantOwned(id, profileId))) error(403, 'Access denied');

	const patch: Record<string, unknown> = { date_updated: new Date() };
	if (typeof body.label === 'string') patch.label = body.label.trim() || 'Alternative';
	if (typeof body.note === 'string') patch.note = body.note.trim() || null;
	if (typeof body.value === 'string') {
		const value = body.value.trim();
		// A variant with no text is not a variant; the way to say "use my own
		// value" is to not pick one, so an emptied value is a mistake rather than
		// an instruction.
		if (!value) error(400, 'A variant needs a value');
		patch.value = value;
	}

	await db.update(profile_field_variants).set(patch).where(eq(profile_field_variants.id, id));

	await touchProfile(profileId);
	return json({ success: true });
};

/**
 * Remove one.
 *
 * Its picks go with it through the cascade on `profile_version_overrides`, and
 * every version that had picked it falls back to the profile's own value — the
 * same thing "no pick" has always meant, so no document breaks. Its
 * translations do not cascade (that sidecar has no foreign key to anything but
 * the profile), so they are deleted here; leaving them would be rows keyed to
 * an id that can be reissued.
 */
export const DELETE: RequestHandler = async ({ locals, cookies, request }) => {
	const user = requireAuth(locals);
	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) error(400, 'No profile selected');

	const body = await request.json().catch(() => null);
	const id = Number(body?.id);
	if (!Number.isInteger(id)) error(400, 'Invalid id');
	if (!(await isVariantOwned(id, profileId))) error(403, 'Access denied');

	await db
		.delete(profile_version_overrides)
		.where(
			and(
				eq(profile_version_overrides.entity_type, OVERRIDE_ENTITIES.fieldVariant),
				eq(profile_version_overrides.entity_id, id)
			)
		);
	await db
		.delete(profile_translations)
		.where(
			and(
				eq(profile_translations.profile_id, profileId),
				eq(profile_translations.entity_type, FIELD_VARIANT_ENTITY),
				eq(profile_translations.entity_id, id)
			)
		);
	await db.delete(profile_field_variants).where(eq(profile_field_variants.id, id));

	await touchProfile(profileId);
	return json({ success: true });
};

/** Reorder a field's variants. Cosmetic — it only changes the picker's list. */
export const PATCH: RequestHandler = async ({ locals, cookies, request }) => {
	const user = requireAuth(locals);
	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) error(400, 'No profile selected');

	const body = await request.json().catch(() => null);
	const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Number.isInteger) : [];
	if (ids.length === 0) error(400, 'Nothing to order');

	// One ownership query for the whole list rather than one per id: the write
	// below is scoped to this profile anyway, and this is what turns a partial
	// match into a rejection instead of a silent partial reorder.
	const owned = await db
		.select({ id: profile_field_variants.id })
		.from(profile_field_variants)
		.where(
			and(eq(profile_field_variants.profile_id, profileId), inArray(profile_field_variants.id, ids))
		);
	if (owned.length !== ids.length) error(403, 'Access denied');

	const now = new Date();
	for (const [index, id] of ids.entries()) {
		await db
			.update(profile_field_variants)
			.set({ sort: index, date_updated: now })
			.where(eq(profile_field_variants.id, id));
	}

	await touchProfile(profileId);
	return json({ success: true });
};
