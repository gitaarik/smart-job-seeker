/**
 * Document visibility for tagged profile items (skills in particular).
 *
 * A profile item sits on two independent axes:
 *   - *known*  — it always counts toward job matching. The matcher reads
 *     `tech_skills` directly (see server/job/match-utils.ts) and never looks at
 *     tags, so nothing here affects scoring.
 *   - *shown*  — whether it prints on a rendered resume/CV.
 *
 * "Profile-only" is the off state of the second axis: the skill stays in the
 * profile so jobs keep matching on it, but no document prints it. That is the
 * common case for a skill you'd defend in an interview but wouldn't headline.
 *
 * It is stored in the existing version-tag array as the pair of base-template
 * exclusions `!resume` + `!cv`, so it needs no schema change and composes with
 * per-version tags: adding a positive version slug alongside them re-admits the
 * item on that one version (see ProfileDisplay/profile-filter.ts).
 */

/** Tags naming a base template rather than a user-defined version. */
export const BASE_TEMPLATE_TAGS = ['resume', 'cv'];

/**
 * Field marking a held-back skill inside the `collected_data` AI snapshot.
 *
 * The snapshot is one blob shared by every prompt, so it has to carry the
 * distinction rather than resolve it: dropping held-back skills at export time
 * also hid them from job matching, which is the one thing they exist to do.
 * Consumers strip the flag — or the whole entry — on the way into a prompt.
 */
export const PROFILE_ONLY_FLAG = 'profile_only';

/**
 * What a profile holds for one skill, in the terms this module defines. Lives
 * here rather than beside the query that builds it so components can name the
 * type without importing a server-only module.
 */
export interface ProfileSkillRef {
	id: number;
	name: string;
	level: string | null;
	categoryId: number;
	/** Held back from every base template — kept for matching, off documents. */
	profileOnly: boolean;
	/** Versions it is re-admitted on despite that. */
	versions: string[];
}

/** The version/template slug of a tag, ignoring a leading "!" negation marker. */
export function tagSlug(tag: string): string {
	return tag.trim().replace(/^!/, '').trim().toLowerCase();
}

/** Whether a tag is an exclusion (`!slug`) rather than an include. */
export function isNegated(tag: string): boolean {
	return tag.trim().startsWith('!');
}

function asTagList(tags: string[] | null | undefined): string[] {
	return Array.isArray(tags) ? tags.filter((t) => typeof t === 'string') : [];
}

/**
 * Whether the item is excluded from every base template — i.e. kept for
 * matching but off all documents (barring a per-version re-admit).
 */
export function isProfileOnly(tags: string[] | null | undefined): boolean {
	const negated = new Set(asTagList(tags).filter(isNegated).map(tagSlug));
	return BASE_TEMPLATE_TAGS.every((t) => negated.has(t));
}

/**
 * Toggle profile-only, leaving per-version tags untouched.
 *
 * Turning it on drops contradictory positive base tags; turning it off only
 * lifts the base-template exclusions, so a `["!resume","!cv","senior"]` skill
 * degrades to "shown, but only on the senior version" rather than losing that
 * restriction. Returns a plain array — callers normalise empty to null.
 */
export function setProfileOnly(tags: string[] | null | undefined, profileOnly: boolean): string[] {
	const list = asTagList(tags);
	const isBase = (t: string) => BASE_TEMPLATE_TAGS.includes(tagSlug(t));

	if (!profileOnly) {
		return list.filter((t) => !(isNegated(t) && isBase(t)));
	}
	return [...BASE_TEMPLATE_TAGS.map((t) => `!${t}`), ...list.filter((t) => !isBase(t))];
}

/**
 * The versions an item is whitelisted onto — the positive tags that name a
 * user-defined version rather than a base template.
 */
export function versionsOf(tags: string[] | null | undefined): string[] {
	return asTagList(tags)
		.filter((t) => !isNegated(t) && !BASE_TEMPLATE_TAGS.includes(tagSlug(t)))
		.map((t) => t.trim());
}

/**
 * Replace that whitelist wholesale, leaving base-template state and explicit
 * `!version` exclusions alone — those answer a different question and an editor
 * changing which versions an item appears on shouldn't silently drop them.
 */
export function setVersions(tags: string[] | null | undefined, versions: string[]): string[] {
	const kept = asTagList(tags).filter(
		(t) => isNegated(t) || BASE_TEMPLATE_TAGS.includes(tagSlug(t))
	);
	return [...kept, ...versions.map((v) => v.trim()).filter(Boolean)];
}

/**
 * Rewrite one item's tags so a tag naming `from` names `to` — or disappears,
 * when `to` is null.
 *
 * Versions are addressed by slug in tags as well as in URLs, so renaming or
 * retiring one has to reach the items that named it. Nothing else does: a tag
 * left naming a version that no longer exists reads as correct at a glance
 * while matching nothing, which is how an item silently stops printing on the
 * document somebody deliberately added it to.
 *
 * Negation survives the rewrite — "never on this one" is a different statement
 * from "only on this one", and a rename is not the place to flip it.
 */
export function renameTagSlug(
	tags: string[] | null | undefined,
	from: string,
	to: string | null
): string[] {
	const slug = tagSlug(from);
	if (!slug) return asTagList(tags);

	return asTagList(tags).flatMap((tag) => {
		if (tagSlug(tag) !== slug) return [tag];
		if (to === null) return [];
		return [isNegated(tag) ? `!${to}` : to];
	});
}

/** Where a held-back item is being lifted to: every document, or one version. */
export const SHOW_ON_ALL = 'all';

/**
 * Tags for "put this item on `target`" — either `SHOW_ON_ALL` or a version slug.
 *
 * Shared by the API route that performs the lift and by the code that predicts
 * whether a lift would actually work, so the two can't drift: a caller offering
 * the action and a caller doing it compute the same array.
 *
 * "Everywhere" has to drop the version whitelist too — lifting only the
 * exclusion pair would leave a re-admit tag behind and silently downgrade the
 * request to "on that one version". Explicit `!version` excludes survive: those
 * say "never here" regardless.
 */
export function tagsForShowOn(tags: string[] | null | undefined, target: string): string[] {
	const list = asTagList(tags);

	if (target === SHOW_ON_ALL) {
		return setProfileOnly(list, false).filter(isNegated);
	}
	const slug = target.trim().toLowerCase();
	return list.some((t) => tagSlug(t) === slug) ? list : [...list, target];
}
