/**
 * Which wording one version uses for one field of one item.
 *
 * The write itself is `setVersionWording` in server/profile/field-variants.ts,
 * shared with the job's document page so a pick made there and a pick made on
 * the version page are the same rows. What this endpoint adds is the checks on
 * what the client sent: the version, the target and the field.
 */

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { profile_versions } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { getSelectedProfileId } from '$lib/server/profile/selected-profile';
import { touchProfile } from '$lib/server/profile/touch-profile';
import { isPrintedVariantField, isVariantEntity } from '$lib/field-variants';
import { isVariantTargetOwned, setVersionWording } from '$lib/server/profile/field-variants';

/**
 * Set (or clear) one version's wording for one target.
 *
 * `variantId: null` chooses the profile's own value. Anything else must be a
 * variant of this profile's, for this target — a pick naming another field's
 * variant would resolve to that other field at render time and read as the
 * feature silently not working.
 *
 * `entity` and `entityId` say whose field: a role's, by the role's id. Left
 * out, it is a field of the profile itself.
 */
export const PUT: RequestHandler = async ({ locals, cookies, request }) => {
	const user = requireAuth(locals);
	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) error(400, 'No profile selected');

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'Invalid body');

	const versionId = Number(body.versionId);
	if (!Number.isInteger(versionId)) error(400, 'Invalid version');

	const entity = body.entity == null ? 'profile' : String(body.entity);
	const field = String(body.field ?? '');
	// Printed fields only. A field the library carries but no document renders
	// has a variant to store and no version to store it against; accepting the
	// pick would write a row nothing ever reads.
	if (!isVariantEntity(entity) || !isPrintedVariantField(entity, field)) {
		error(400, 'Field cannot be picked per version');
	}
	const entityId = entity === 'profile' ? profileId : Number(body.entityId);
	if (!Number.isInteger(entityId)) error(400, 'Invalid id');

	const variantId = body.variantId == null ? null : Number(body.variantId);
	if (variantId !== null && !Number.isInteger(variantId)) error(400, 'Invalid variant');

	// Every id comes from the client. The version and the target are confirmed
	// against this profile here; the variant is confirmed against the target by
	// the write.
	const version = await db
		.select({ id: profile_versions.id })
		.from(profile_versions)
		.where(and(eq(profile_versions.id, versionId), eq(profile_versions.profile_id, profileId)))
		.limit(1);
	if (version.length === 0) error(403, 'Access denied');
	if (!(await isVariantTargetOwned(profileId, entity, entityId))) error(403, 'Access denied');

	// The one thing the write refuses: a variant that is not this target's.
	if (!(await setVersionWording({ profileId, versionId, entity, entityId, field, variantId }))) {
		error(403, 'Access denied');
	}

	await touchProfile(profileId);
	return json({ success: true, versionId, entity, entityId, field, variantId });
};
