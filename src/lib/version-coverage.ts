/**
 * How well each candidate document covers the skills a job requires — and which
 * one to recommend.
 *
 * The measurement happens server-side (server/profile/hidden-required-skills.ts
 * runs the real document filter per base template × version). This module holds
 * the shapes and the ranking, because the document type is unsaved client state:
 * the applicant flips between Resume and CV before deciding, and the
 * recommendation has to follow that flip without a round trip.
 *
 * Client-safe: pure data + helpers, no DB.
 */

export interface HiddenSkill {
	id: number;
	name: string;
	/**
	 * Whether the one-click lift would actually reveal it here. False when
	 * something else holds it back — a hidden category, or a base-template
	 * restriction like `["cv"]` on a resume — in which case the caller should
	 * report the gap rather than offer a button that appears to do nothing.
	 */
	liftable: boolean;
	/**
	 * A skill the document DOES print that carries this one's name as a whole
	 * word — "SQL optimization" for "SQL", "AWS EC2" for "AWS". Null when
	 * nothing does.
	 *
	 * Not a verdict, a fact. A keyword search for the required skill finds it
	 * there already; a person skimming a skills list may not read it as the
	 * same claim. Which of those two readers matters is per application, so the
	 * skill stays offered and the caller says this alongside it.
	 */
	carriedBy: string | null;
}

/** What one candidate document does with the skills this job requires. */
export interface VersionCoverage {
	/** Required skills the profile has AND this document prints. */
	shown: string[];
	/** Required skills the profile has but this document won't print. */
	hidden: HiddenSkill[];
	/** Required skills the profile has at all — the best any document could do. */
	owned: number;
	/** Distinct skills the job requires. */
	required: number;
}

/**
 * A skill name split the way anything reading the document splits it.
 *
 * "SQL optimization" is two words; "MySQL" is one, and is not the word SQL —
 * which is the whole reason this is tokens and not substrings. `+` and `#` stay
 * inside a word so C++ and C# survive as themselves.
 */
export function skillWords(name: string): string[] {
	return name
		.toLowerCase()
		.split(/[^a-z0-9+#]+/i)
		.filter(Boolean);
}

/** Whether `haystack` contains every word of `needle`, in order and adjacent. */
export function carriesName(needle: string, haystack: string): boolean {
	const want = skillWords(needle);
	const have = skillWords(haystack);
	if (want.length === 0 || want.length > have.length) return false;
	if (want.length === have.length) return want.every((w, i) => have[i] === w);
	return have.some((_, i) => want.every((w, j) => have[i + j] === w));
}

/**
 * The first of `printed` that carries `name` — the evidence for "the word is
 * already on the page". Skips the skill's own name: a document printing SQL
 * outright isn't carrying it, it's showing it, and that is a different answer
 * the coverage map has already given.
 */
export function carrierOf(name: string, printed: string[]): string | null {
	const self = name.trim().toLowerCase();
	return (
		printed.find((other) => other.trim().toLowerCase() !== self && carriesName(name, other)) ?? null
	);
}

/**
 * Key into the coverage map. `versionSlug` is "" when no version is picked,
 * which is a real document in its own right (the plain base template).
 */
export function hiddenSkillsKey(docType: string, versionSlug: string): string {
	return `${docType}:${versionSlug}`;
}

export interface Recommendation {
	versionSlug: string;
	coverage: VersionCoverage;
}

/**
 * The version to suggest for one base template: most required skills shown,
 * then fewest hidden, then the applicant's own ordering.
 *
 * The plain, version-less document is the YARDSTICK, not a candidate answer.
 * Pass it first (`''`) so ties resolve to it, and a version is then only
 * suggested when it genuinely beats the baseline rather than because it sorted
 * first — but when the baseline wins, the answer is silence.
 *
 * That distinction is not pedantry: the plain document usually cannot be sent.
 * `/p/[slug]/resume` with no version falls back to the profile's *public*
 * version, PDF export is keyed by slug, and the send-record card offers no link
 * for it — so "send the plain resume" names an artifact that, for most
 * profiles, does not exist.
 *
 * Returns null when there is nothing worth saying: no coverage was measured
 * (the job lists no required skills, or the profile has none of them), no
 * candidate shows a single required skill, or nothing beat the baseline — in
 * which case which version you send makes no difference to this job's required
 * skills, and saying anything would be a confident-sounding coin flip.
 */
export function recommendVersion(
	coverage: Record<string, VersionCoverage>,
	docType: string,
	candidateSlugs: string[]
): Recommendation | null {
	let best: Recommendation | null = null;

	for (const versionSlug of candidateSlugs) {
		const entry = coverage[hiddenSkillsKey(docType, versionSlug)];
		if (!entry) continue;
		if (!best) {
			best = { versionSlug, coverage: entry };
			continue;
		}
		const better =
			entry.shown.length > best.coverage.shown.length ||
			(entry.shown.length === best.coverage.shown.length &&
				entry.hidden.length < best.coverage.hidden.length);
		if (better) best = { versionSlug, coverage: entry };
	}

	if (!best || best.versionSlug === '' || best.coverage.shown.length === 0) return null;
	return best;
}
