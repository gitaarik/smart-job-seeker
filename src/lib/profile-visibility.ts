/**
 * Where a tagged profile item is shown (skills in particular).
 *
 * A profile item sits on two independent axes:
 *   - *known*  — it always counts toward job matching. The matcher reads
 *     `tech_skills` directly (see server/job/match-utils.ts) and never looks at
 *     tags, so nothing here affects scoring.
 *   - *shown*  — which base templates it appears on: the resume, the CV, and
 *     since the public site arrived, the site.
 *
 * The second axis is stored in the existing version-tag array as exclusions
 * (`!resume`) or as a positive whitelist (`cv`), so it needs no schema change
 * and composes with per-version tags: a positive version slug alongside an
 * exclusion re-admits the item on that one version (see
 * ProfileDisplay/profile-filter.ts).
 *
 * "Profile-only" is the off state of the documents: the skill stays in the
 * profile so jobs keep matching on it, but nothing sent prints it. That is the
 * common case for a skill you'd defend in an interview but wouldn't headline,
 * and it stays a question about DOCUMENTS — `isHiddenFromDocuments`. Being on
 * the site is a separate switch, because "not on my CV" and "not on the web"
 * are different sentences and the tags said only the first until the site
 * existed.
 */

/**
 * The base templates a tag can name, and what each one is.
 *
 * One list, because every other answer here is derived from it: a tag that
 * names one of these is not a version slug, and the two questions the rest of
 * this module asks are "which of these does the item name" and "which of them
 * are printed". `portfolio` joined on 2026-09-18 with the public site; before
 * that the only base templates were documents and the distinction had nowhere
 * to show.
 */
export const BASE_TEMPLATES = [
	{ tag: 'resume', surface: 'document', label: 'Resume' },
	{ tag: 'cv', surface: 'document', label: 'CV' },
	{ tag: 'portfolio', surface: 'site', label: 'Site' }
] as const;

/** Tags naming a base template rather than a user-defined version. */
export const BASE_TEMPLATE_TAGS: string[] = BASE_TEMPLATES.map((t) => t.tag);

/**
 * The base templates that are printed and sent, as opposed to published.
 *
 * "Off all documents" is `!resume` + `!cv` and stays that pair: it is what the
 * AI snapshot's profile-only flag is computed from, what tailoring asks about,
 * and what a skill someone would defend in an interview but not headline is
 * marked with. Keeping the site out of it is the point — an item can be on the
 * site and off the documents, which is a state somebody picks rather than a
 * default that a third tag silently changed.
 */
export const DOCUMENT_TEMPLATE_TAGS: string[] = BASE_TEMPLATES.filter(
	(t) => t.surface === 'document'
).map((t) => t.tag);

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

/** The base template a render means when it names none. */
export function normalizeTemplateType(type: string | null | undefined): string {
	return (type || 'resume').trim().toLowerCase();
}

/** An item's tags as slugs, split by whether they exclude or include. */
function splitTags(tags: string[] | null | undefined): { negated: string[]; positives: string[] } {
	const list = asTagList(tags);
	return {
		negated: list.filter(isNegated).map(tagSlug).filter(Boolean),
		positives: list
			.filter((t) => !isNegated(t))
			.map(tagSlug)
			.filter(Boolean)
	};
}

/**
 * The base templates this item names positively, which act as a whitelist.
 *
 * The one place that question is answered. A positive `cv` means "on the CV,
 * not the others", and with three base templates there is no "the other one"
 * to compare against: what decides is whether the current template is among
 * the ones named. Reading it as a two-way choice is what let an item tagged
 * `resume` vanish from the site while one tagged `cv` stayed.
 */
export function baseTemplatePositives(tags: string[] | null | undefined): string[] {
	return splitTags(tags).positives.filter((p) => BASE_TEMPLATE_TAGS.includes(p));
}

/**
 * Whether the item is excluded from every DOCUMENT template — i.e. kept for
 * matching but off the resume and the CV (barring a per-version re-admit).
 *
 * Deliberately not "off everything": the public site is a base template too,
 * and an item can be on it while off the documents. This is the predicate the
 * `collected_data` snapshot's profile-only flag is computed from, so widening
 * it would change what document-writing prompts are shown, silently and
 * without a failing test.
 */
export function isHiddenFromDocuments(tags: string[] | null | undefined): boolean {
	const { negated } = splitTags(tags);
	return DOCUMENT_TEMPLATE_TAGS.every((t) => negated.includes(t));
}

/** Whether this item's base-template tags allow it on `type`. */
export function shownOnTemplate(tags: string[] | null | undefined, type: string): boolean {
	const current = normalizeTemplateType(type);
	if (splitTags(tags).negated.includes(current)) return false;
	const positives = baseTemplatePositives(tags);
	return positives.length === 0 || positives.includes(current);
}

/** The base templates this item currently appears on. */
export function shownTemplates(tags: string[] | null | undefined): string[] {
	return BASE_TEMPLATE_TAGS.filter((t) => shownOnTemplate(tags, t));
}

/**
 * Write which base templates the item appears on, leaving version tags alone.
 *
 * The one primitive the switches and `setProfileOnly` are both built from.
 * Writing the whole state rather than editing one tag is what makes it
 * unambiguous: tags can say "on the CV" either as a positive whitelist or as
 * exclusions of the others, and an incremental "now also show it here" has no
 * single right answer against a whitelist. This canonicalises on exclusions,
 * which is the shape the stored data already uses, and says nothing at all
 * when the item is on every template, since that is the default.
 */
export function setBaseTemplates(tags: string[] | null | undefined, shownOn: string[]): string[] {
	const wanted = new Set(shownOn.map(normalizeTemplateType));
	const rest = asTagList(tags).filter((t) => !BASE_TEMPLATE_TAGS.includes(tagSlug(t)));
	const hidden = BASE_TEMPLATE_TAGS.filter((t) => !wanted.has(t));
	return [...hidden.map((t) => `!${t}`), ...rest];
}

/** Show or hide the item on ONE base template, leaving the other two as they are. */
export function setShownOn(
	tags: string[] | null | undefined,
	type: string,
	shown: boolean
): string[] {
	const slug = normalizeTemplateType(type);
	const others = shownTemplates(tags).filter((t) => t !== slug);
	return setBaseTemplates(tags, shown ? [...others, slug] : others);
}

/**
 * Toggle "off all documents", leaving the site and per-version tags untouched.
 *
 * Turning it off degrades a `["!resume","!cv","senior"]` skill to "shown, but
 * only on the senior version" rather than losing that restriction. Returns a
 * plain array — callers normalise empty to null.
 */
export function setProfileOnly(tags: string[] | null | undefined, profileOnly: boolean): string[] {
	const site = shownTemplates(tags).filter((t) => !DOCUMENT_TEMPLATE_TAGS.includes(t));
	return setBaseTemplates(tags, profileOnly ? site : [...site, ...DOCUMENT_TEMPLATE_TAGS]);
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

/**
 * Whether a BASE TEMPLATE rule holds this item back, rather than a version tag.
 *
 * The two are different instructions and only one is a per-job matter. "Not on
 * my resume, only my CV" is a statement about the document type that no
 * particular job changes; "only on my Django versions" is a statement about
 * emphasis, and picking it up for a job that wants Django is the whole point of
 * tailoring. A per-job override wins over both — filterOnTags checks it first —
 * so anything that adds items back has to decline this case itself.
 *
 * The skills strip already draws the same line: it will not offer a one-click
 * lift for a CV-only skill on a resume, because the lift would not reveal it.
 */
export function heldBackByTemplate(tags: string[] | null | undefined, docType: string): boolean {
	const list = asTagList(tags);
	if (list.length === 0) return false;

	const current = normalizeTemplateType(docType);
	const { negated } = splitTags(tags);
	const otherDocuments = DOCUMENT_TEMPLATE_TAGS.filter((t) => t !== current);

	// "!resume" alone; the off-all-documents pair is not this — that is the
	// state a version tag is meant to re-admit from. Asked of the documents
	// only: `!portfolio` says nothing about whether a resume may print this.
	if (negated.includes(current)) return !otherDocuments.every((t) => negated.includes(t));

	// Another base template named, this one not.
	const positives = baseTemplatePositives(tags);
	return positives.length > 0 && !positives.includes(current);
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
