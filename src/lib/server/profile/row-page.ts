/**
 * Where a person opens one row of their profile.
 *
 * Every section has a list page, and the registry's `page` names it. That is
 * the right answer for a skill and the wrong one for a role project: the
 * work experience list shows its name at most, and its description is only on
 * the project's own page. So this answers with the row's page where the row
 * has one, or where it is edited on its parent's, and null where the list is
 * as close as it gets.
 */

import { PROFILE_RESOURCES, type ProfileResourceName } from './resources';
import { readOwnedRow, type ProfileActor } from './write';

/**
 * Whether any row of this section opens somewhere other than its list.
 *
 * Decided from the declarations alone, so a section with no such page costs no
 * read. A skill hangs off a category that has none, and a feed can hold dozens
 * of skill changes.
 */
function hasRowPages(name: ProfileResourceName): boolean {
	const resource = PROFILE_RESOURCES[name];
	if (resource.detailPath || resource.nestedPath) return true;
	return resource.owner.via === 'parent' && hasRowPages(resource.owner.parent);
}

/**
 * The page this row is on, or null for one that is only on its list, or that
 * is gone or not this actor's.
 *
 * A child row with no page of its own is on its parent's: a role's
 * achievements and technologies are on the role's page, and a project's
 * technologies on the project's. Finding the parent takes a read, and it is
 * an owned read like every other, so a row that is not theirs gets no link
 * rather than one naming whose it is.
 */
export async function rowPagePath(
	name: ProfileResourceName,
	actor: ProfileActor,
	id: number
): Promise<string | null> {
	const resource = PROFILE_RESOURCES[name];
	if (resource.detailPath) return resource.detailPath(id);
	if (resource.owner.via !== 'parent' || !hasRowPages(name)) return null;

	const row = await readOwnedRow(name, actor, id);
	if (!row) return null;

	// `key` is declared by hand beside the column; a wrong one reads undefined,
	// and no link is better than one to /work-experience/NaN.
	const parentId = Number(row[resource.owner.key]);
	if (!Number.isInteger(parentId)) return null;

	return resource.nestedPath
		? resource.nestedPath(parentId, id)
		: rowPagePath(resource.owner.parent, actor, parentId);
}
