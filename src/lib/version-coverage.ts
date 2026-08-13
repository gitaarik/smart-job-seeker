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

export interface BaseChoice {
	versionSlug: string;
	/** Relevant bullets sitting on roles this version does not print. */
	outOfReach: number;
	/** Required skills it holds in a group it does not print. */
	unreachableSkills: number;
	/** Which of the two decided it, so the caller can say the true reason. */
	decidedBy: 'evidence' | 'skills';
}

/**
 * Which version to build a tailored one ON — ranked by what it puts out of
 * reach, not by what it covers.
 *
 * Coverage was the criterion until the base stopped deciding the contents (see
 * planning/TAILORED-VERSIONS.md D14). It is the right measure for "which of my
 * versions should I send as it is", and the wrong one here twice over: a
 * required skill the applicant has is PINNED onto whatever this starts from, so
 * the base's coverage says nothing about the finished document, and every other
 * eligible item competes regardless of which version it was written for.
 *
 * What a base still decides is the CONTAINERS. A bullet on a role this document
 * omits can never be surfaced — adding a whole role changes the shape of a
 * history rather than its emphasis — and a required skill in a group it omits
 * cannot even be pinned. So the question worth asking is which version leaves
 * the least of this job's evidence unreachable, which is the one measure that
 * still varies with the choice.
 *
 * Returns null when nothing separates the candidates, which after D14 is the
 * common case: with the containers equal, every base produces the same
 * document, and naming one as "closest" would be a reason invented after the
 * fact. The caller falls back to the version the applicant sends by default —
 * their own answer, and a better one than an arbitrary winner.
 */
export function recommendBase(
	docType: string,
	candidateSlugs: string[],
	measures: {
		/** Per `hiddenSkillsKey`, relevant items on containers this document omits. */
		outOfReach: Record<string, number>;
		coverage: Record<string, VersionCoverage>;
	}
): BaseChoice | null {
	const scored = candidateSlugs.map((versionSlug) => {
		const key = hiddenSkillsKey(docType, versionSlug);
		return {
			versionSlug,
			outOfReach: measures.outOfReach[key] ?? 0,
			// Not `hidden.length`: a skill the document could show if its own tag
			// were lifted is reachable, and the tailoring run lifts it. Only the
			// ones a hidden group or a base-template rule holds back are beyond it.
			unreachableSkills: (measures.coverage[key]?.hidden ?? []).filter((h) => !h.liftable).length
		};
	});
	if (scored.length === 0) return null;

	const best = scored.reduce((a, z) =>
		z.outOfReach < a.outOfReach ||
		(z.outOfReach === a.outOfReach && z.unreachableSkills < a.unreachableSkills)
			? z
			: a
	);
	// UNIQUELY best, or there is nothing to say.
	//
	// "Better than something" is not enough, and the difference is the whole
	// honesty of the sentence: measured on a real job, six of this profile's
	// seven versions tied at nothing out of reach and the seventh held one
	// required skill in a group it omits. Announcing the first of the six as the
	// one that "keeps the most in reach" would be true of all six and a reason
	// invented for one — while quietly overriding the version the applicant
	// actually sends.
	const leaders = scored.filter(
		(c) => c.outOfReach === best.outOfReach && c.unreachableSkills === best.unreachableSkills
	);
	if (leaders.length !== 1) return null;

	return {
		...best,
		decidedBy: scored.some((c) => c.outOfReach > best.outOfReach) ? 'evidence' : 'skills'
	};
}
