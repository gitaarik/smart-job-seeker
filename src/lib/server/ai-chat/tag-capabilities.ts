/**
 * `tag_<section>` — where an entry prints, changed by an agent with the
 * applicant's approval: the same document tags the entry's page sets under
 * "Resume / CV Versions".
 *
 * ## Why tags were kept away from agents, and what changed
 *
 * `tags` is `notForAssistant` on every section that has it, because a wrong
 * value is silent: a version slug that matches no version drops the entry from
 * every document without an error, and the applicant finds out from a resume
 * that is missing a job. That is still true of `edit_*`, which takes whatever
 * string it is given.
 *
 * The page never had that problem, and not because a person is more careful.
 * It offers chips from a fixed list — the three base templates and the
 * profile's own library versions, each as "show only on" or "hide from" — so a
 * tag that names nothing cannot be typed there. This verb takes the same list
 * and nothing else: an unknown tag is refused with the list in the refusal,
 * while the agent can still correct it, rather than written. With that, the
 * agent can do what the page does. Before it, "keep this line on my CV but off
 * my resume" had two answers over MCP, neither of them that: a hide, which takes
 * the line off the CV too, or a set of clicks handed back to the applicant.
 *
 * ## Why only over MCP
 *
 * The same reasons as `reorder-capabilities.ts`: in the app the tags are a
 * click on the page the entry is on, and the chat's capability block has no
 * room for another verb per section. So these are in `CAPABILITIES`, where the
 * approval page, the history and its undo find them, and in `MCP_CAPABILITIES`,
 * and in no route's scope.
 *
 * ## Always a request
 *
 * `tiers.ts` makes every one Tier 2. A tag decides which documents print the
 * entry, and adding one to an entry that has none would otherwise read as
 * filling an empty field, which goes straight through.
 */

import { and, asc, eq, isNull } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { profile_versions } from '$lib/server/db/schema';
import {
	HIDEABLE_RESOURCES,
	PROFILE_RESOURCES,
	type HideableResourceName
} from '$lib/server/profile/resources';
import { readOwnedRow, setRowTags } from '$lib/server/profile/write';
import { BASE_TEMPLATES, BASE_TEMPLATE_TAGS, isNegated, tagSlug } from '$lib/profile-visibility';
import { PROFILE_CAPABILITIES } from './profile-capabilities';
import type { CapabilityDef, ProposedChange } from './capabilities';

export type TagCapability = `tag_${HideableResourceName}`;

export const TAG_CAPABILITY_NAMES = HIDEABLE_RESOURCES.map(
	(name) => `tag_${name}` as TagCapability
);

export function isTagCapability(name: string): name is TagCapability {
	return (TAG_CAPABILITY_NAMES as string[]).includes(name);
}

/** Where `current` carries the profile's library versions, beside the tags. Not a field. */
export const VERSIONS = 'versions';

/**
 * The versions an entry can be tagged onto: the library, never a tailored one.
 *
 * The page's list, read the same way (`/api/profile-versions`). A version made
 * for one application expresses itself through overrides rather than shared
 * tags, and a tag naming it would outlive the application it was made for.
 */
export async function libraryVersions(profileId: number): Promise<string[]> {
	const rows = await db.query.profile_versions.findMany({
		where: and(eq(profile_versions.profile_id, profileId), isNull(profile_versions.application_id)),
		columns: { slug: true },
		orderBy: asc(profile_versions.slug)
	});
	return rows.map((row) => (row.slug ?? '').trim()).filter(Boolean);
}

/**
 * A proposed tag list, checked against the only tags that mean something here,
 * and written the way the page writes them.
 *
 * Compared without case, because every reader of a tag compares through
 * `tagSlug`; written with a version's own spelling, because that is what the
 * page writes and what a person reading the row expects to find. A repeat is
 * dropped rather than refused — it changes nothing — but a tag and its own
 * negation are refused: the negation wins in `profile-filter.ts`, so the
 * positive half says something the document will not do.
 */
export function checkTags(
	value: unknown,
	versions: string[]
): { ok: true; tags: string[] } | { ok: false; error: string } {
	if (!Array.isArray(value) || value.some((tag) => typeof tag !== 'string')) {
		return {
			ok: false,
			error: 'The tags must be a list of strings; an empty list prints it everywhere'
		};
	}

	const spelling = new Map<string, string>(BASE_TEMPLATE_TAGS.map((tag) => [tag, tag]));
	for (const version of versions) spelling.set(version.toLowerCase(), version);

	const tags: string[] = [];
	const unknown: string[] = [];
	for (const raw of value as string[]) {
		if (raw.trim() === '') continue;
		const known = spelling.get(tagSlug(raw));
		if (!known) {
			unknown.push(raw.trim());
			continue;
		}
		const tag = isNegated(raw) ? `!${known}` : known;
		if (!tags.includes(tag)) tags.push(tag);
	}

	if (unknown.length > 0) {
		return {
			ok: false,
			error:
				`${unknown.map((tag) => `"${tag}"`).join(', ')} ${unknown.length === 1 ? 'is not a tag' : 'are not tags'} ` +
				`this profile has. A tag is ${vocabulary(versions)}, as written, with or without a "!" in front`
		};
	}

	const contradicted = tags.filter((tag) => !isNegated(tag) && tags.includes(`!${tag}`));
	if (contradicted.length > 0) {
		const [tag] = contradicted;
		return {
			ok: false,
			error:
				`"${tag}" and "!${tag}" say opposite things, and the "!" would win on every document. ` +
				`Keep the one that was asked for`
		};
	}

	return { ok: true, tags };
}

/** "resume", "cv", "portfolio" or one of their versions: …, as a refusal lists them. */
function vocabulary(versions: string[]): string {
	const bases = BASE_TEMPLATE_TAGS.map((tag) => `"${tag}"`).join(', ');
	return versions.length > 0
		? `${bases} or one of their versions: ${versions.map((v) => `"${v}"`).join(', ')}`
		: `${bases} (they have no versions yet)`;
}

/** How a base template is called where the applicant reads it. */
function templateName(tag: string): string {
	const label = BASE_TEMPLATES.find((template) => template.tag === tag)?.label ?? tag;
	return label === 'Resume' ? 'resume' : label === 'Site' ? 'site' : label;
}

/** "the resume or CV", "the site". */
function theTemplates(tags: string[], joiner: 'or' | 'and'): string {
	const names = tags.map(templateName);
	const listed =
		names.length > 1 ? `${names.slice(0, -1).join(', ')} ${joiner} ${names.at(-1)}` : names[0];
	return `the ${listed}`;
}

/** "the citrus version", "the fullstack-django and citrus versions". */
function theVersions(slugs: string[]): string {
	const listed =
		slugs.length > 1 ? `${slugs.slice(0, -1).join(', ')} and ${slugs.at(-1)}` : slugs[0];
	return `the ${listed} ${slugs.length > 1 ? 'versions' : 'version'}`;
}

/**
 * A tag list as the sentence a person would say about it.
 *
 * What `profile-filter.ts` does with the list, read out: base-template
 * positives are a whitelist over the templates, base-template negatives take it
 * off one, a version positive is a whitelist over versions — and re-admits the
 * entry on that version when a base template is excluded — and a version
 * negative keeps it off that version whatever else is true.
 */
export function whereItPrints(value: unknown): string {
	const tags = Array.isArray(value)
		? value.filter((tag): tag is string => typeof tag === 'string' && tag.trim() !== '')
		: [];
	if (tags.length === 0) return 'Everywhere';

	const slug = (tag: string) => tagSlug(tag);
	const isBase = (tag: string) => BASE_TEMPLATE_TAGS.includes(slug(tag));
	const onlyOn = tags.filter((t) => !isNegated(t) && isBase(t)).map(slug);
	const notOn = tags.filter((t) => isNegated(t) && isBase(t)).map(slug);
	const onlyIn = tags.filter((t) => !isNegated(t) && !isBase(t)).map((t) => t.trim());
	const neverIn = tags.filter((t) => isNegated(t) && !isBase(t)).map((t) => t.trim().slice(1));

	const parts: string[] = [];
	if (onlyOn.length > 0) parts.push(`only on ${theTemplates(onlyOn, 'and')}`);
	if (notOn.length > 0) {
		parts.push(
			onlyIn.length > 0
				? `not on ${theTemplates(notOn, 'or')}, except in ${theVersions(onlyIn)}`
				: `not on ${theTemplates(notOn, 'or')}`
		);
	} else if (onlyIn.length > 0) {
		parts.push(`only in ${theVersions(onlyIn)}`);
	}
	if (neverIn.length > 0) parts.push(`never in ${theVersions(neverIn)}`);

	const sentence = parts.join('; ');
	return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function tagCapability(name: HideableResourceName): CapabilityDef {
	const resource = PROFILE_RESOURCES[name];
	const editor = PROFILE_CAPABILITIES[`edit_${name}`];
	const field = `${name}.tags`;

	const versionsIn = (current: Record<string, unknown>) =>
		Array.isArray(current[VERSIONS]) ? (current[VERSIONS] as string[]) : [];

	return {
		title: `Change where this ${resource.label} prints`,

		// The edit verb's targeting: a row of this section, named by id.
		resolve: editor.resolve,
		resolveMany: editor.resolveMany,
		authorize: editor.authorize,

		/** The row's tags, and the versions a tag may name. Read fresh every time. */
		current: async (t, actor) => {
			const [row, versions] = await Promise.all([
				readOwnedRow(name, { profileId: actor.profileId }, t.id),
				libraryVersions(actor.profileId)
			]);
			return { [field]: (row?.tags as string[] | null) ?? [], [VERSIONS]: versions };
		},

		fields: { [field]: 'stringArray' },
		requiredFields: [field],

		contract: `You may propose changing where one of their ${resource.title.toLowerCase()} prints: the
tags its page sets under "Resume / CV Versions".

Send the complete new list in "${field}". A tag you leave out is removed, so
read the entry's current "tags" with read_profile_section first and change only
what was asked. An empty list prints it everywhere.

What each tag does:
- "resume", "cv" or "portfolio" (their public site): print it only there. "cv"
  on its own keeps it off the resume.
- The same with "!" in front: keep it off there. "!resume" prints it everywhere
  but the resume, and "!resume" with "!cv" is what hiding it does.
- The name of one of their versions: print it only on that version. With "!" in
  front: never on that version.

Only those tags are accepted. A version is checked against the versions they
have, because one that names nothing would silently drop the entry from every
document.${resource.hideNote ? `\n\n${resource.hideNote}` : ''}`,

		renderState: (current) => {
			const tags = Array.isArray(current[field]) ? (current[field] as string[]) : [];
			const versions = versionsIn(current);
			return (
				`It prints: ${whereItPrints(tags)} (tags: ${tags.length > 0 ? tags.join(', ') : 'none'}).` +
				`\n\nTheir versions: ${versions.length > 0 ? versions.join(', ') : 'none yet'}.`
			);
		},

		validate: (fields, current) => {
			const checked = checkTags(fields[field], versionsIn(current));
			if (!checked.ok) return checked;

			const before = (Array.isArray(current[field]) ? (current[field] as string[]) : []).map(
				(tag) => tag.trim().toLowerCase()
			);
			const after = checked.tags.map((tag) => tag.toLowerCase());
			if (before.length === after.length && after.every((tag) => before.includes(tag))) {
				return { ok: false, error: 'Those are already its tags, so there is nothing to change' };
			}
			return { ok: true };
		},

		/**
		 * The tags as they were, read fresh: what the undo writes back, and what the
		 * card reads "before" from. A request is stored and rendered later with no
		 * database to ask (see `CapabilityDef.describeChanges`).
		 */
		beforeImage: async (t, _current, actor) => {
			const row = await readOwnedRow(name, { profileId: actor.profileId }, t.id);
			return { tags: (row?.tags as string[] | null) ?? null };
		},

		// A request carries its before-image; a chat proposal would carry `current`.
		// Both are read, so neither shape renders as a change from nothing.
		describeChanges: (fields, previous): ProposedChange[] => [
			{
				field,
				label: 'Where it prints',
				from: whereItPrints(previous.tags ?? previous[field]),
				to: whereItPrints(fields[field])
			}
		],

		apply: async (t, fields, _current, actor) => {
			// Checked again against a fresh read: a request can wait for days, and a
			// version renamed or deleted in between would otherwise be written as a
			// tag that names nothing — the one failure this verb exists to rule out.
			const checked = checkTags(fields[field], await libraryVersions(actor.profileId));
			if (!checked.ok) throw new Error(`tag_${name} refused at write time: ${checked.error}`);

			const result = await setRowTags(name, { profileId: actor.profileId }, t.id, checked.tags);
			if (!result.ok) throw new Error(`tag_${name} refused at write time: ${result.error}`);
		},

		/** Put the recorded tags back exactly, the way a hide's undo does. */
		revert: async (t, previous, actor) => {
			const tags = Array.isArray(previous.tags) ? (previous.tags as string[]) : null;
			const result = await setRowTags(name, { profileId: actor.profileId }, t.id, tags);
			if (!result.ok) throw new Error(`tag_${name} could not be undone: ${result.error}`);
		}
	};
}

export const TAG_CAPABILITIES = Object.fromEntries(
	HIDEABLE_RESOURCES.map((name) => [`tag_${name}`, tagCapability(name)])
) as Record<TagCapability, CapabilityDef>;
