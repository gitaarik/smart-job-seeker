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
 * `candidateSlugs` is passed in the order the applicant would see them, plain
 * base document first, and ties resolve to the earliest — so a version only
 * gets recommended when it genuinely beats sending the plain document, never
 * because it happened to sort first.
 *
 * Returns null when there is nothing to say: no coverage was measured (the job
 * lists no required skills, or the profile has none of them), or no candidate
 * shows a single required skill — in which case a recommendation would be a
 * confident-sounding coin flip.
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

	return best && best.coverage.shown.length > 0 ? best : null;
}
