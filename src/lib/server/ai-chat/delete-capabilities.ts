/**
 * `delete_<section>`: an entry removed for good, asked for by an agent and
 * confirmed by the applicant.
 *
 * ## Why there is one now
 *
 * Until 2026-11-10 no agent could delete anything. The assistant proposed
 * `hide_*` instead, because a proposal card is accepted in one click and a
 * delete is not recoverable from a before-image (see `setRowVisible`). That
 * left two gaps. A section with no hide (a role project, a language, a
 * reference) could not be taken off anything by an agent at all, and an entry
 * the applicant wanted gone, not hidden, came back to them as a list of deletes
 * to make by hand. The case that asked for this: three role projects written
 * while the applicant was still being vetted by a client they then started
 * working for. An agent could say why they should go and then had to hand over
 * SQL.
 *
 * ## What keeps it from being a one-click mistake
 *
 * - MCP only, and in no route's scope, like `reorder_*`. The chat sits next to
 *   the editors, whose own Delete buttons are already there, and its prompt
 *   budget is spent.
 * - `irreversible`, so always a request (`tiers.ts`), whatever the key's scope.
 * - The card names what goes with the entry: everything filed under it and the
 *   files attached to it, which `ON DELETE CASCADE` takes along.
 * - Approving takes two steps: Delete on the card, then a confirmation that
 *   says it cannot be undone. `approveRequest` refuses a delete without that
 *   confirmation, so the second step does not depend on the page drawing it.
 * - The history keeps the row's values and what went with it, so "where did
 *   that go" has an answer even though nothing can put it back.
 *
 * ## Why it cannot be put back
 *
 * A role project owns its technologies and the documents attached to it, and a
 * role owns its achievements, technologies and projects, all through
 * `ON DELETE CASCADE`. A re-create would restore a row with the same text and
 * none of the things that hung off it. So there is no `revert`, and the history
 * offers no undo rather than one that restores half.
 */

import { and, asc, eq, inArray } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { profile_document_projects, work_experience_projects } from '$lib/server/db/schema';
import {
	HIDEABLE_RESOURCES,
	PROFILE_RESOURCE_NAMES,
	PROFILE_RESOURCES,
	type ProfileResourceName
} from '$lib/server/profile/resources';
import { deleteRow, readOwnedRow } from '$lib/server/profile/write';
import { parseTranslationField } from '$lib/server/profile/section-translations';
import { describeFieldChanges } from './field-changes';
import { descendantCounts, PROFILE_CAPABILITIES } from './profile-capabilities';
import type { CapabilityActor, CapabilityDef, ProposedChange } from './capabilities';

export type DeleteCapability = `delete_${ProfileResourceName}`;

export const DELETE_CAPABILITY_NAMES = PROFILE_RESOURCE_NAMES.map(
	(name) => `delete_${name}` as DeleteCapability
);

export function isDeleteCapability(name: string): name is DeleteCapability {
	return (DELETE_CAPABILITY_NAMES as string[]).includes(name);
}

/**
 * Where a delete's before-image keeps what went with the row, one line per
 * kind ("2 role projects", "3 files: …"). Not a column of any section, so the
 * history's column diff passes over it and `deletedWithChange` adds it back.
 */
export const DELETED_WITH = 'deleted_with';

/** How many file names a card prints before it counts the rest. */
const FILES_NAMED = 5;

/** The sections filed directly under this one. */
function childSections(name: ProfileResourceName): ProfileResourceName[] {
	return PROFILE_RESOURCE_NAMES.filter((child) => {
		const { owner } = PROFILE_RESOURCES[child];
		return owner.via === 'parent' && owner.parent === name;
	});
}

/** "a role project" or "3 role projects", as the card counts them. */
function counted(count: number, name: ProfileResourceName): string {
	const { label, title } = PROFILE_RESOURCES[name];
	return count === 1 ? `1 ${label}` : `${count} ${title.toLowerCase()}`;
}

/**
 * The names of the files the delete takes along.
 *
 * A role project's and a side project's attached documents go with them
 * (`ON DELETE CASCADE`), and so do the documents of a role's projects, which go
 * with the role. Documents attached to the role itself are only detached
 * (`ON DELETE SET NULL`), so they are not listed. A certificate's own upload is
 * removed with it by `deleteRow` (`ownedFiles`).
 */
async function attachedFiles(
	name: ProfileResourceName,
	id: number,
	actor: CapabilityActor
): Promise<{ names: string[]; upload: boolean }> {
	const owned = PROFILE_RESOURCES[name].ownedFiles ?? [];
	if (owned.length > 0) {
		const row = await readOwnedRow(name, { profileId: actor.profileId }, id);
		return { names: [], upload: owned.some((column) => row?.[column]) };
	}

	const attachedTo =
		name === 'work_experience_project'
			? eq(profile_document_projects.work_experience_project_id, id)
			: name === 'side_project'
				? eq(profile_document_projects.side_project_id, id)
				: name === 'work_experience'
					? inArray(
							profile_document_projects.work_experience_project_id,
							db
								.select({ id: work_experience_projects.id })
								.from(work_experience_projects)
								.where(eq(work_experience_projects.work_experience_id, id))
						)
					: null;
	if (!attachedTo) return { names: [], upload: false };

	const rows = await db
		.select({
			title: profile_document_projects.title,
			filename: profile_document_projects.original_filename
		})
		.from(profile_document_projects)
		.where(and(eq(profile_document_projects.profile_id, actor.profileId), attachedTo))
		.orderBy(asc(profile_document_projects.sort), asc(profile_document_projects.id));

	return { names: rows.map((row) => row.title || row.filename || 'Untitled file'), upload: false };
}

/** Everything the cascade takes along with the row, one line per kind. */
export async function deletedWith(
	name: ProfileResourceName,
	id: number,
	actor: CapabilityActor
): Promise<string[]> {
	const [counts, files] = await Promise.all([
		descendantCounts(name, id, actor),
		attachedFiles(name, id, actor)
	]);

	const lines = counts.map(({ resource, count }) => counted(count, resource));
	if (files.upload) lines.push('its uploaded file');
	if (files.names.length > 0) {
		const { names } = files;
		const more = names.length - FILES_NAMED;
		lines.push(
			`${names.length} ${names.length === 1 ? 'file' : 'files'}: ` +
				names.slice(0, FILES_NAMED).join(', ') +
				(more > 0 ? `, and ${more} more` : '')
		);
	}
	return lines;
}

/**
 * The "Deleted with it" line of a delete, on its card and in the history.
 *
 * Empty for a deletion that took nothing along, and for one made on an
 * editor's page, which records only the row (see `deleteRow`).
 */
export function deletedWithChange(previous: Record<string, unknown>): ProposedChange[] {
	const lines = previous[DELETED_WITH];
	if (!Array.isArray(lines) || lines.length === 0) return [];
	return [{ field: DELETED_WITH, label: 'Deleted with it', from: lines.join('; '), to: '—' }];
}

function deleteCapability(name: ProfileResourceName): CapabilityDef {
	const resource = PROFILE_RESOURCES[name];
	const editor = PROFILE_CAPABILITIES[`edit_${name}`];
	const title = resource.title.toLowerCase();

	const children = childSections(name).map((child) => PROFILE_RESOURCES[child].title.toLowerCase());
	const filed =
		children.length > 0
			? ` and everything filed under it (its ${children.join(', ').replace(/, ([^,]*)$/, ' and $1')})`
			: '';
	const files =
		name === 'work_experience_project' || name === 'side_project'
			? ', with the files attached to it'
			: name === 'work_experience'
				? ', with the files attached to its projects'
				: resource.ownedFiles?.length
					? ', with its uploaded file'
					: '';

	const instead = (HIDEABLE_RESOURCES as readonly string[]).includes(name)
		? `If they want it off their CVs, that is hide_${name}, which can be undone. Ask
for a delete only when they want it gone, not hidden.`
		: `This section has no hide, so a delete is how one of its entries comes off
their profile when they ask for that.`;

	return {
		title: `Delete this ${resource.label}`,

		// The edit verb's targeting: every row of the section, named by id.
		resolve: editor.resolve,
		resolveMany: editor.resolveMany,
		authorize: editor.authorize,
		current: editor.current,

		fields: {},

		irreversible: true,
		tierFor: () => ({ tier: 2, reason: 'Deleting an entry cannot be undone.' }),

		contract: `You may ask to delete one of their ${title}, for good.

Deleting removes the entry${filed}${files}. It cannot be undone.

${instead}

Ask only when they have said they want it deleted, not because it looks
outdated or weak to you. It always waits for their approval, and they confirm
it a second time before anything is deleted.

This request carries no fields. Name the entry and say why in the rationale.`,

		validate: () => ({ ok: true }),

		/**
		 * The row as it reads now, and what goes with it.
		 *
		 * Recorded at the request and again when it is applied: the card shows the
		 * first, the history keeps the second. Only the row's own values, which the
		 * history describes as it does an editor's delete; `current` also carries
		 * what the edit verb offers beside them (every role a project could move
		 * to), which is not part of what was deleted.
		 */
		beforeImage: async (t, current, actor) => ({
			...Object.fromEntries(
				Object.entries(current).filter(([field]) => field.startsWith(`${name}.`))
			),
			[DELETED_WITH]: await deletedWith(name, t.id, actor)
		}),

		/**
		 * The row's values going to nothing, then what goes with them. English only:
		 * the translations go too, and listing them would double the card to say so.
		 */
		describeChanges: (_fields, previous) => [
			...describeFieldChanges(
				Object.keys(previous).filter(
					(field) => field.startsWith(`${name}.`) && !parseTranslationField(field)
				),
				{},
				previous
			),
			...deletedWithChange(previous)
		],

		apply: async (t, _fields, _current, actor) => {
			const result = await deleteRow(name, { profileId: actor.profileId }, t.id);
			if (!result.ok) {
				throw new Error(`delete_${name} refused at write time: ${result.error}`);
			}
		}
	};
}

export const DELETE_CAPABILITIES = Object.fromEntries(
	PROFILE_RESOURCE_NAMES.map((name) => [`delete_${name}`, deleteCapability(name)])
) as Record<DeleteCapability, CapabilityDef>;
