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
