/**
 * Skill words a version prints that no skill on the profile holds.
 *
 * A job's match credits words through related skills: "Monitoring" through
 * Sentry, "Tool Calling" on the model's own judgement. The word itself then
 * appears nowhere on the document, and a keyword search for it finds nothing.
 * The application page used to fix that by adding a profile skill under the
 * job's word, which by construction duplicated one the applicant already had
 * ("Tool Calling" beside "Function calling") and, shown on documents by
 * default, printed the job's vocabulary on every resume they sent. The match
 * gained nothing from the row, since it already counted the word. So the word
 * now lives on the one version that wants it: `profile_version_skill_words`.
 *
 * `loadDocumentSkillWords` reads the words a rendered version carries, and
 * `applySkillWords` puts them into their skill groups in the loaded profile
 * tree, the same in-place trick applyTranslations and applyFieldVariants use,
 * so no renderer needs to know this exists. Each goes in front of the skill the
 * applicant placed it before, or at the end of the group. Words ride the version's extension
 * chain like its overrides do: a tailored version kept in the library and then
 * built on passes them on.
 *
 * A word never prints twice. One the document already prints as a skill of its
 * own, because the applicant has since added it to the profile or shown one
 * they had kept off, stays out, and the profile's own row speaks for it.
 */

import { dbDirect as db } from '$lib/server/db';
import { asc, inArray } from 'drizzle-orm';
import { profile_version_skill_words } from '$lib/server/db/schema';
import { createProfileFilter } from '$lib/components/ProfileDisplay/profile-filter';
import { OVERRIDE_ENTITIES } from '$lib/version-overrides';
import { skillWords } from '$lib/version-coverage';

export interface SkillWord {
	id: number;
	versionId: number;
	categoryId: number;
	name: string;
	reason: string | null;
	/** The skill it prints in front of; null puts it at the end of its group. */
	beforeSkillId: number | null;
}

/** What a version needs for its chain to be walked: the tree's shape and the query's. */
export interface ChainVersion {
	id: number;
	extension_links?: ReadonlyArray<{ extended_id: number | null }> | null;
}

/**
 * A version and everything it extends, root first.
 *
 * The order createProfileFilter reads overrides in, so "first one wins" means
 * the same thing for a word as for a decision: the version being viewed beats
 * the one it builds on. Guarded against a cycle, which nothing in the schema
 * forbids.
 */
export function versionChain(versions: ReadonlyArray<ChainVersion>, rootId: number): number[] {
	const byId = new Map(versions.map((v) => [v.id, v]));
	const chain: number[] = [];
	const visit = (id: number) => {
		const version = byId.get(id);
		if (!version || chain.includes(id)) return;
		chain.push(id);
		for (const link of version.extension_links ?? []) {
			if (link.extended_id != null) visit(link.extended_id);
		}
	};
	visit(rootId);
	return chain;
}

const key = (name: unknown) => (typeof name === 'string' ? name.trim().toLowerCase() : '');

/**
 * Every word the given versions hold, in chain order.
 *
 * Scoped to the profile as well as to the ids: the ids come from a tree or a
 * form, and a word from somebody else's version must resolve to nothing rather
 * than to their text.
 */
export async function loadSkillWords(
	profileId: number,
	versionIds: number[]
): Promise<SkillWord[]> {
	if (versionIds.length === 0) return [];
	const rows =
		(await db.query.profile_version_skill_words.findMany({
			where: inArray(profile_version_skill_words.version_id, versionIds),
			columns: {
				id: true,
				version_id: true,
				category_id: true,
				name: true,
				reason: true,
				before_skill_id: true
			},
			with: { version: { columns: { profile_id: true } } },
			orderBy: asc(profile_version_skill_words.id)
		})) ?? [];

	const rank = new Map(versionIds.map((id, i) => [id, i]));
	return rows
		.filter((row) => row.version?.profile_id === profileId)
		.map((row) => ({
			id: row.id,
			versionId: row.version_id,
			categoryId: row.category_id,
			name: row.name,
			reason: row.reason,
			beforeSkillId: row.before_skill_id
		}))
		.sort((a, b) => (rank.get(a.versionId) ?? 0) - (rank.get(b.versionId) ?? 0));
}

/**
 * The version a document route's renderer will apply: the one the load
 * resolved, or failing that the `?version=` slug, which ProfileDisplay,
 * StructuredResume and the portfolio fall back to on their own. Asking the same
 * question the renderer asks is what keeps a word on exactly the documents that
 * carry its version's overrides.
 */
export function renderedVersionId(
	profile: { profile_versions?: ReadonlyArray<{ id: number; slug?: string | null }> | null },
	versionId: number | null | undefined,
	versionSlug: string | null
): number | null {
	if (versionId) return versionId;
	if (!versionSlug) return null;
	return profile.profile_versions?.find((v) => v.slug === versionSlug)?.id ?? null;
}

/**
 * The words the document for `versionId` carries, walked through the version
 * chain the loaded tree describes.
 *
 * A version the tree does not hold (an unpublished one) carries nothing, which
 * is what the renderer's filter concludes about its overrides too.
 */
export async function loadDocumentSkillWords(
	profile: { id: number; profile_versions?: ReadonlyArray<ChainVersion> | null },
	versionId: number | null | undefined
): Promise<SkillWord[]> {
	if (!versionId) return [];
	return loadSkillWords(profile.id, versionChain(profile.profile_versions ?? [], versionId));
}

/**
 * The words that print, given what the document already prints.
 *
 * First per name down the chain, and none the skills block already prints by
 * name. `printedCategories`, when given, also drops a word whose group the
 * document leaves out, which is what the renderer does by reaching the group
 * first; the tree overlay leaves that to the renderer.
 */
export function wordsToPrint(
	words: ReadonlyArray<SkillWord>,
	printedNames: ReadonlySet<string>,
	printedCategories?: ReadonlySet<number>
): SkillWord[] {
	const seen = new Set<string>();
	return words.filter((word) => {
		const name = key(word.name);
		if (!name || seen.has(name) || printedNames.has(name)) return false;
		if (printedCategories && !printedCategories.has(word.categoryId)) return false;
		seen.add(name);
		return true;
	});
}

/** The skills-block names one document prints, asked of the renderer's own filter. */
export function printedSkillNames(
	profile: {
		profile_versions?: unknown;
		tech_skill_categories?: ReadonlyArray<{
			id: number;
			tags?: unknown;
			tech_skills?: ReadonlyArray<{ id: number; name?: unknown; tags?: unknown }> | null;
		}> | null;
	},
	docType: string | null,
	versionId: number | null
): Set<string> {
	const { filterOnTags } = createProfileFilter(
		(profile.profile_versions ?? []) as never,
		docType,
		versionId,
		''
	);
	const names = new Set<string>();
	for (const group of filterOnTags(
		[...(profile.tech_skill_categories ?? [])],
		OVERRIDE_ENTITIES.skillCategory
	)) {
		for (const skill of filterOnTags([...(group.tech_skills ?? [])], OVERRIDE_ENTITIES.skill)) {
			const name = key(skill.name);
			if (name) names.add(name);
		}
	}
	return names;
}

/**
 * Put a version's words into their skill groups in a loaded profile tree,
 * mutating it in place: in front of the skill each was placed before, else at
 * the end of the group. Several placed before one skill keep the order they
 * were added in.
 *
 * Each becomes a row shaped like a skill with no tags, so every renderer's
 * filter keeps it wherever it keeps the group, and it keeps its place through
 * that filter: a skill the document leaves out takes nothing with it, so a word
 * placed before one lands after whatever prints ahead of it. The id is the
 * word's own, negated: an override is keyed by a skill id, and a synthetic row
 * must never answer to a decision about a real one.
 *
 * `docType` and `versionId` name the document being rendered, the same pair the
 * page hands its renderer, so "already printed" is asked of that document and
 * not of the profile at large. A word whose profile twin is kept off this
 * document still prints; one whose twin prints does not.
 */
export function applySkillWords<T>(
	profile: T,
	words: ReadonlyArray<SkillWord>,
	docType: string | null,
	versionId: number | null | undefined
): T {
	if (!profile || words.length === 0) return profile;

	// Generic in the tree it is handed so call sites keep their own profile type,
	// the shape applyFieldVariants uses. One cast here, none at the routes.
	const tree = profile as unknown as {
		profile_versions?: unknown;
		tech_skill_categories?: Array<{
			id: number;
			tech_skills?: Array<Record<string, unknown> & { id: number }> | null;
		}> | null;
	};
	const groups = tree.tech_skill_categories ?? [];
	const printed = printedSkillNames(tree as never, docType, versionId ?? null);

	const toPrint = wordsToPrint(words, printed);
	for (const group of groups) {
		const mine = toPrint.filter((word) => word.categoryId === group.id);
		if (mine.length === 0) continue;
		const row = (word: SkillWord) => ({
			id: -word.id,
			name: word.name,
			category_id: word.categoryId,
			level: null,
			years_experience: null,
			tags: null,
			sort: null
		});
		const skills = group.tech_skills ?? [];
		const placed = new Set(skills.map((skill) => skill.id));
		group.tech_skills = [
			...skills.flatMap((skill) => [
				...mine.filter((word) => word.beforeSkillId === skill.id).map(row),
				skill
			]),
			// No place, or a place in another group or gone from this one.
			...mine
				.filter((word) => word.beforeSkillId === null || !placed.has(word.beforeSkillId))
				.map(row)
		];
	}
	return profile;
}

/** Words too common to say two skill names are about the same thing. */
const FILLER_WORDS = new Set(['and', 'the', 'for', 'with', 'of', 'in', 'on', 'to', 'a', 'an']);

/**
 * Where a credited word most likely belongs: beside the skill it stands in for.
 *
 * The skill the match credited it through, when the match recorded one:
 * "Monitoring" through Sentry goes beside Sentry. Failing that, the first skill
 * sharing one of its words, which is how "Tool Calling", credited on the model's
 * own judgement, finds "Function calling". Both null when neither says anything;
 * the page then offers the first group the document prints, at its end.
 *
 * It answers with the related skill rather than a position. What prints next to
 * that skill depends on the document, and the page knows which one it is.
 */
export function suggestPlace(
	skill: string,
	from: string | null,
	groups: ReadonlyArray<{
		id: number;
		tech_skills: ReadonlyArray<{ id: number; name: string | null }>;
	}>
): { categoryId: number | null; anchorSkillId: number | null } {
	const find = (test: (name: string) => boolean) => {
		for (const group of groups) {
			const hit = group.tech_skills.find((s) => test(key(s.name)));
			if (hit) return { categoryId: group.id, anchorSkillId: hit.id };
		}
		return null;
	};
	if (from) {
		const home = find((name) => name === key(from));
		if (home) return home;
	}
	const words = new Set(skillWords(skill).filter((w) => w.length > 2 && !FILLER_WORDS.has(w)));
	return (
		find((name) => skillWords(name).some((w) => words.has(w))) ?? {
			categoryId: null,
			anchorSkillId: null
		}
	);
}
