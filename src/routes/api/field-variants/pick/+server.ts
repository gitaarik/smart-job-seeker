/**
 * Which wording one version uses for one field.
 *
 * Stored as a `profile_version_overrides` row rather than in a table of its
 * own — see the entity's entry in $lib/version-overrides.ts for why. The rule
 * the schema cannot enforce is enforced here: a field holds one value, so
 * setting a pick clears whatever else this version had picked for the same
 * field, and clearing a pick means deleting the row rather than storing a
 * sentinel for "the default", which is what the absence of a row has always
 * meant.
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, eq, inArray } from 'drizzle-orm';
import {
	profile_field_variants,
	profile_version_overrides,
	profile_versions
} from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { getSelectedProfileId } from '$lib/server/profile/selected-profile';
import { touchProfile } from '$lib/server/profile/touch-profile';
import { isVariantField, variantFieldLabel } from '$lib/field-variants';
import { OVERRIDE_ENTITIES } from '$lib/version-overrides';

/** The ids of this profile's variants for one field. */
async function variantIdsForField(profileId: number, field: string): Promise<number[]> {
	const rows = await db
		.select({ id: profile_field_variants.id })
		.from(profile_field_variants)
		.where(
			and(eq(profile_field_variants.profile_id, profileId), eq(profile_field_variants.field, field))
		);
	return rows.map((r) => r.id);
}

/**
 * Set (or clear) one version's wording for one field.
 *
 * `variantId: null` clears it. Anything else must be a variant of this
 * profile's, for this field — a pick naming another field's variant would
 * resolve to nothing at render time and read as the feature silently not
 * working.
 */
export const PUT: RequestHandler = async ({ locals, cookies, request }) => {
	const user = requireAuth(locals);
	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) error(400, 'No profile selected');

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'Invalid body');

	const versionId = Number(body.versionId);
	if (!Number.isInteger(versionId)) error(400, 'Invalid version');

	const field = String(body.field ?? '');
	if (!isVariantField(field)) error(400, 'Field cannot have variants');

	const variantId = body.variantId == null ? null : Number(body.variantId);
	if (variantId !== null && !Number.isInteger(variantId)) error(400, 'Invalid variant');

	// Both ids come from the client. The version is confirmed against this
	// profile, and the variant against this profile AND this field.
	const version = await db
		.select({ id: profile_versions.id })
		.from(profile_versions)
		.where(and(eq(profile_versions.id, versionId), eq(profile_versions.profile_id, profileId)))
		.limit(1);
	if (version.length === 0) error(403, 'Access denied');

	const fieldVariantIds = await variantIdsForField(profileId, field);
	if (variantId !== null && !fieldVariantIds.includes(variantId)) error(403, 'Access denied');

	// Clear this field's picks first, in both branches. Setting one is a
	// replacement, not an addition, and a clear is the same statement with
	// nothing after it.
	if (fieldVariantIds.length > 0) {
		await db
			.delete(profile_version_overrides)
			.where(
				and(
					eq(profile_version_overrides.version_id, versionId),
					eq(profile_version_overrides.entity_type, OVERRIDE_ENTITIES.fieldVariant),
					inArray(profile_version_overrides.entity_id, fieldVariantIds)
				)
			);
	}

	if (variantId !== null) {
		const now = new Date();
		await db.insert(profile_version_overrides).values({
			version_id: versionId,
			entity_type: OVERRIDE_ENTITIES.fieldVariant,
			entity_id: variantId,
			action: 'include',
			// 'user', so a regeneration of a tailored version leaves it standing —
			// the same protection every hand-made include/exclude gets.
			source: 'user',
			reason: `you chose this ${variantFieldLabel(field).toLowerCase()} for this version`,
			date_created: now,
			date_updated: now
		});
	}

	await touchProfile(profileId);
	return json({ success: true, versionId, field, variantId });
};
