/**
 * The verbs that manage resume versions themselves, as opposed to where an
 * entry prints on one (that is `tag_*`): make a version, rename one, delete
 * one, and make one the public resume or CV.
 *
 * Making one touches no document and applies directly, as an add does. The
 * other three change what the applicant sends or shows, so they always ask
 * (mcp/tiers.ts). A delete states in its request what it would touch, read
 * when it was asked for: the versions built on it, the applications sent with
 * it, and the items tagged for it alone, which go where the request says and
 * never onto every version (retireVersionTag).
 *
 * MCP-only, like the tag verbs: a person does all of this on the Resumes & CVs
 * page, so the chat is never offered them (ability-manifest.ts).
 */
import { versionDeleteImpact, type VersionDeleteImpact } from '$lib/server/profile/version-tags';
import {
	createVersion,
	deleteVersion,
	listLibraryVersions,
	renameVersion,
	restorePublicVersions,
	setPublicVersion,
	slugFromName,
	VersionError,
	type LibraryVersion
} from '$lib/server/profile/versions';
import { isReservedVersionSlug } from '$lib/version-overrides';
import type { CapabilityDef, CapabilityTarget, ProposedChange } from './capabilities';

export type VersionCapability =
	| 'add_resume_version'
	| 'rename_resume_version'
	| 'delete_resume_version'
	| 'set_public_resume_version';

export const VERSION_CAPABILITY_NAMES: VersionCapability[] = [
	'add_resume_version',
	'rename_resume_version',
	'delete_resume_version',
	'set_public_resume_version'
];

export function isVersionCapability(name: string): name is VersionCapability {
	return (VERSION_CAPABILITY_NAMES as string[]).includes(name);
}

const NAME = 'resume_version.name';
const SLUG = 'resume_version.slug';
const MOVE_TO = 'resume_version.move_to';
const PUBLIC_RESUME = 'resume_version.public_resume';
const PUBLIC_CV = 'resume_version.public_cv';

/** Where `current` carries the other versions' slugs. Not a field. */
const TAKEN = 'taken_slugs';
const IMPACT = 'impact';

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const titleOf = (v: { name: string | null; slug: string | null }) =>
	v.name?.trim() || v.slug || 'Untitled version';

async function libraryTarget(profileId: number, id: number): Promise<LibraryVersion | null> {
	return (await listLibraryVersions(profileId)).find((v) => v.id === id) ?? null;
}

/** A slug's problem known without the database: what validate can say at once. */
function slugIssue(slug: string, taken: string[]): string | null {
	if (!slug) return 'A version needs a name or a slug.';
	if (isReservedVersionSlug(slug)) {
		return `"${slug}" is reserved: "app-<number>" belongs to job-tailored versions, and resume, cv and portfolio name base templates.`;
	}
	if (taken.includes(slug.toLowerCase())) return `Another version already uses the slug "${slug}".`;
	return null;
}

/** Shared by the three verbs that name an existing version. */
const onLibraryVersion = {
	// Named by version_id through mcp/entities.ts; nothing on a page resolves one.
	resolve: async () => null,
	resolveMany: async (_entity: unknown, actor: { profileId: number }) =>
		(await listLibraryVersions(actor.profileId)).map((v) => ({ id: v.id, label: titleOf(v) })),
	authorize: async (target: CapabilityTarget, actor: { profileId: number }) =>
		(await libraryTarget(actor.profileId, target.id)) !== null
};

const addVersion: CapabilityDef = {
	title: 'Make a new resume version',
	// An add names no row: the profile is implied by the key.
	resolve: async (_entity, actor) => ({ id: actor.profileId, label: 'a new resume version' }),
	authorize: async () => true,
	current: async (_target, actor) => ({
		[TAKEN]: (await listLibraryVersions(actor.profileId)).map((v) => v.slug.toLowerCase())
	}),
	fields: { [NAME]: 'string', [SLUG]: 'string' },
	requiredFields: [NAME],
	contract: `You may make a new resume version: a named selection of their profile they
can send, which starts out printing everything that has no version tags.

"${NAME}" is what they will see it called, e.g. "AI Engineer". "${SLUG}" is how
item tags and share links name it; leave it out and it is made from the name.
Then put entries on it with the tag_* tools, which name it by that slug.`,
	validate: (fields, current) => {
		const slug = text(fields[SLUG]) || slugFromName(text(fields[NAME]));
		const issue = slugIssue(slug, (current[TAKEN] as string[]) ?? []);
		return issue ? { ok: false, error: issue } : { ok: true };
	},
	describeChanges: (fields): ProposedChange[] => [
		{
			field: NAME,
			label: 'New resume version',
			from: '',
			to: `${text(fields[NAME])} (${text(fields[SLUG]) || slugFromName(text(fields[NAME]))})`
		}
	],
	apply: async (_target, fields, _current, actor) => {
		try {
			const made = await createVersion(actor.profileId, {
				name: text(fields[NAME]),
				slug: text(fields[SLUG]) || null
			});
			return { id: made.id, label: titleOf(made) };
		} catch (e) {
			if (e instanceof VersionError)
				throw new Error(`add_resume_version refused: ${e.message}`, { cause: e });
			throw e;
		}
	},
	/** Undone only while nothing names it yet: then deleting it loses nothing. */
	revert: async (target, _previous, actor) => {
		const impact = await versionDeleteImpact(actor.profileId, target.id);
		if (!impact) return;
		if (impact.onlyHere.length > 0 || impact.builtOnIt > 0 || impact.sentWith > 0) {
			throw new Error(
				'The version is in use now (entries tagged onto it, versions built on it or an application sent with it), so it was not deleted.'
			);
		}
		await deleteVersion(actor.profileId, target.id);
	}
};

const renameResumeVersion: CapabilityDef = {
	title: 'Rename a resume version',
	...onLibraryVersion,
	current: async (target, actor) => {
		const versions = await listLibraryVersions(actor.profileId);
		const version = versions.find((v) => v.id === target.id);
		return {
			[NAME]: version?.name ?? '',
			[SLUG]: version?.slug ?? '',
			[TAKEN]: versions.filter((v) => v.id !== target.id).map((v) => v.slug.toLowerCase())
		};
	},
	fields: { [NAME]: 'string', [SLUG]: 'string' },
	contract: `You may propose renaming one of their resume versions, its slug included.

Send "${NAME}", "${SLUG}" or both. A new slug is carried to everything that
names the version by it: the tags on their entries and the record of which
applications it was sent to. Share links that use the old slug stop working.`,
	validate: (fields, current) => {
		const name = text(fields[NAME]);
		const slug = text(fields[SLUG]);
		if (!name && !slug) return { ok: false, error: `Send "${NAME}", "${SLUG}" or both.` };
		const nameChanges = name !== '' && name !== text(current[NAME]);
		const slugChanges = slug !== '' && slug.toLowerCase() !== text(current[SLUG]).toLowerCase();
		if (!nameChanges && !slugChanges) {
			return { ok: false, error: 'That is already its name, so there is nothing to change.' };
		}
		if (slugChanges) {
			const issue = slugIssue(slug, (current[TAKEN] as string[]) ?? []);
			if (issue) return { ok: false, error: issue };
		}
		return { ok: true };
	},
	// Asked about even when it only names a version that had no name: what a
	// version is called is what they pick it by when they send it.
	tierFor: () => ({ tier: 2, reason: 'Renaming a version changes how they find and link it.' }),
	beforeImage: async (_target, current) => ({ name: current[NAME], slug: current[SLUG] }),
	describeChanges: (fields, previous): ProposedChange[] => {
		const changes: ProposedChange[] = [];
		const name = text(fields[NAME]);
		const slug = text(fields[SLUG]);
		if (name) changes.push({ field: NAME, label: 'Name', from: text(previous.name), to: name });
		if (slug) changes.push({ field: SLUG, label: 'Slug', from: text(previous.slug), to: slug });
		return changes;
	},
	apply: async (target, fields, _current, actor) => {
		try {
			await renameVersion(actor.profileId, target.id, {
				name: text(fields[NAME]) || undefined,
				slug: text(fields[SLUG]) || null
			});
		} catch (e) {
			if (e instanceof VersionError)
				throw new Error(`rename_resume_version refused: ${e.message}`, { cause: e });
			throw e;
		}
	},
	revert: async (target, previous, actor) => {
		await renameVersion(actor.profileId, target.id, {
			name: text(previous.name) || null,
			slug: text(previous.slug) || null
		});
	}
};

/**
 * One line per thing a delete touches, for the request card.
 *
 * The card strikes out each line's "from", so "from" is always the state that
 * ends: an entry tagged for this version alone is not deleted, and striking
 * its name would say it is.
 */
function deleteLines(
	impact: VersionDeleteImpact,
	moveTo: string,
	version: string
): ProposedChange[] {
	const lines: ProposedChange[] = [
		{ field: 'resume_version', label: 'Version', from: version, to: 'Deleted' }
	];
	if (impact.onlyHere.length > 0) {
		const names = impact.onlyHere
			.slice(0, 8)
			.map((item) => `${item.label} (${item.kind.toLowerCase()})`);
		if (impact.onlyHere.length > 8) names.push(`and ${impact.onlyHere.length - 8} more`);
		lines.push({
			field: MOVE_TO,
			label: `Tagged for this version only: ${names.join(', ')}`,
			from: `Only on ${version}`,
			to: moveTo ? `On ${moveTo}` : 'Kept off every document'
		});
	}
	if (impact.builtOnIt > 0) {
		lines.push({
			field: 'resume_version.built_on_it',
			label: `Built on it: ${impact.builtOnIt} ${impact.builtOnIt === 1 ? 'version' : 'versions'}`,
			from: `Starting from ${version}`,
			to: 'Their own choices only'
		});
	}
	if (impact.sentWith > 0) {
		lines.push({
			field: 'resume_version.sent_with',
			label: `Sent with it: ${impact.sentWith} ${impact.sentWith === 1 ? 'application' : 'applications'}`,
			from: `Linked to ${version}`,
			to: 'Record kept, without the link'
		});
	}
	if (impact.publicResume || impact.publicCv) {
		const what =
			impact.publicResume && impact.publicCv
				? 'resume and CV'
				: impact.publicResume
					? 'resume'
					: 'CV';
		lines.push({
			field: 'resume_version.public',
			label: `Public ${what}`,
			from: version,
			to: 'Nothing public until another is picked'
		});
	}
	return lines;
}

const deleteResumeVersion: CapabilityDef = {
	title: 'Delete a resume version',
	...onLibraryVersion,
	current: async (target, actor) => {
		const versions = await listLibraryVersions(actor.profileId);
		const version = versions.find((v) => v.id === target.id);
		return {
			[NAME]: version ? titleOf(version) : '',
			[TAKEN]: versions.filter((v) => v.id !== target.id).map((v) => v.slug),
			[IMPACT]: await versionDeleteImpact(actor.profileId, target.id)
		};
	},
	fields: { [MOVE_TO]: 'string' },
	// Naming nowhere to move them is the request to keep them off.
	noFieldsNeeded: true,
	contract: `You may propose deleting one of their resume versions. It cannot be undone.

Read list_resume_versions first: for each version it says how many entries are
tagged for that version alone. Deleting it would otherwise leave those entries
on no version, so they go to the version named in "${MOVE_TO}" (its slug), or,
with none named, stay off every document. Tagging them onto other versions
first (tag_*) is the gentler way when they belong on more than one.

The request lists what it touches, for them to see before approving: those
entries, the versions built on it, the applications sent with it (which keep
that record), and whether it is their public resume or CV.`,
	validate: (fields, current) => {
		const moveTo = text(fields[MOVE_TO]);
		if (
			moveTo &&
			!((current[TAKEN] as string[]) ?? []).some((s) => s.toLowerCase() === moveTo.toLowerCase())
		) {
			return {
				ok: false,
				error: `"${moveTo}" is not another of their versions. Call list_resume_versions for the slugs.`
			};
		}
		return { ok: true };
	},
	tierFor: () => ({
		tier: 2,
		reason: 'Deleting a version changes what they send and cannot be undone.'
	}),
	// Read when it was asked for, so the card shows what they agreed to.
	beforeImage: async (_target, current) => ({ name: current[NAME], impact: current[IMPACT] }),
	describeChanges: (fields, previous): ProposedChange[] => {
		const impact = previous[IMPACT] as VersionDeleteImpact | null;
		const empty: VersionDeleteImpact = {
			onlyHere: [],
			builtOnIt: 0,
			sentWith: 0,
			publicResume: false,
			publicCv: false
		};
		return deleteLines(impact ?? empty, text(fields[MOVE_TO]), text(previous.name));
	},
	apply: async (target, fields, _current, actor) => {
		try {
			await deleteVersion(actor.profileId, target.id, text(fields[MOVE_TO]) || null);
		} catch (e) {
			if (e instanceof VersionError)
				throw new Error(`delete_resume_version refused: ${e.message}`, { cause: e });
			throw e;
		}
	},
	appliedNote: () => 'Deleted. A deleted version cannot be put back.'
};

const setPublicResumeVersion: CapabilityDef = {
	title: 'Make a resume version the public one',
	...onLibraryVersion,
	current: async (target, actor) => {
		const versions = await listLibraryVersions(actor.profileId);
		const version = versions.find((v) => v.id === target.id);
		return {
			[NAME]: version ? titleOf(version) : '',
			[PUBLIC_RESUME]: version?.publicResume ?? false,
			[PUBLIC_CV]: version?.publicCv ?? false,
			public_resume: versions.find((v) => v.publicResume) ?? null,
			public_cv: versions.find((v) => v.publicCv) ?? null
		};
	},
	fields: { [PUBLIC_RESUME]: 'boolean', [PUBLIC_CV]: 'boolean' },
	contract: `You may propose making one of their resume versions the public resume, the
public CV, or both: what their profile sends when no version is named, what
their public page shows, and what a resume tailored to a job starts from.

Set "${PUBLIC_RESUME}" and/or "${PUBLIC_CV}" to true. It replaces the version
public now, which keeps everything else it had.`,
	validate: (fields, current) => {
		const resume = fields[PUBLIC_RESUME] === true;
		const cv = fields[PUBLIC_CV] === true;
		if (!resume && !cv) {
			return { ok: false, error: `Set "${PUBLIC_RESUME}", "${PUBLIC_CV}" or both to true.` };
		}
		if ((!resume || current[PUBLIC_RESUME] === true) && (!cv || current[PUBLIC_CV] === true)) {
			return { ok: false, error: 'It is already public for that, so there is nothing to change.' };
		}
		return { ok: true };
	},
	tierFor: () => ({
		tier: 2,
		reason: 'The public version is what they send by default and show on their page.'
	}),
	/** What was public in the slots this changes: the card's "before", and the undo. */
	beforeImage: async (_target, current, _actor, fields) => {
		const slot = (value: unknown) => {
			const version = value as LibraryVersion | null;
			return version ? { id: version.id, name: titleOf(version) } : { id: null, name: null };
		};
		const resume = slot(current.public_resume);
		const cv = slot(current.public_cv);
		return {
			name: current[NAME],
			...(fields[PUBLIC_RESUME] === true ? { resume_id: resume.id, resume_name: resume.name } : {}),
			...(fields[PUBLIC_CV] === true ? { cv_id: cv.id, cv_name: cv.name } : {})
		};
	},
	describeChanges: (fields, previous): ProposedChange[] => {
		const changes: ProposedChange[] = [];
		const name = text(previous.name);
		if (fields[PUBLIC_RESUME] === true) {
			changes.push({
				field: PUBLIC_RESUME,
				label: 'Public resume',
				from: text(previous.resume_name) || 'None',
				to: name
			});
		}
		if (fields[PUBLIC_CV] === true) {
			changes.push({
				field: PUBLIC_CV,
				label: 'Public CV',
				from: text(previous.cv_name) || 'None',
				to: name
			});
		}
		return changes;
	},
	apply: async (target, fields, _current, actor) => {
		try {
			await setPublicVersion(actor.profileId, target.id, {
				resume: fields[PUBLIC_RESUME] === true,
				cv: fields[PUBLIC_CV] === true
			});
		} catch (e) {
			if (e instanceof VersionError) {
				throw new Error(`set_public_resume_version refused: ${e.message}`, { cause: e });
			}
			throw e;
		}
	},
	/** Put back what was public in the slots it changed, and only those. */
	revert: async (_target, previous, actor) => {
		await restorePublicVersions(actor.profileId, {
			...('resume_id' in previous ? { resume: (previous.resume_id as number | null) ?? null } : {}),
			...('cv_id' in previous ? { cv: (previous.cv_id as number | null) ?? null } : {})
		});
	}
};

export const VERSION_CAPABILITIES: Record<VersionCapability, CapabilityDef> = {
	add_resume_version: addVersion,
	rename_resume_version: renameResumeVersion,
	delete_resume_version: deleteResumeVersion,
	set_public_resume_version: setPublicResumeVersion
};
