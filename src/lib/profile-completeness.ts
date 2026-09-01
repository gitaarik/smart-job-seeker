/**
 * What "set up well enough to be matched" means, in one place.
 *
 * The dashboard's Getting Started card and the page that decides whether to
 * show it both need this answer, and they are different files. It lived in
 * both for about ten minutes and that was long enough to see the problem: the
 * card would call a profile complete while the page kept showing it, or the
 * reverse, and neither would look wrong on its own.
 */

/**
 * Skills below which matching measurably underperforms.
 *
 * The bar used to be one. That is what the step taught: add a single skill,
 * watch the line go green, conclude the product considers you ready.
 *
 * Measured on preview 2026-08-31 — profiles with 5-10 skills averaged match
 * scores of 16-45 with essentially nothing above 70; profiles with 57 or more
 * averaged 58-62 with roughly 45% above 70. The mechanism is not subtle.
 * `skill_match_percentage` divides the matched count by the JOB's skill count,
 * so a short profile cannot score well on that axis however good the fit; and
 * the eligibility gate drops a job outright when no profile skill string
 * equals one of the job's, which for a short list is most jobs.
 *
 * 12 is the round number under that gap rather than a measured optimum, and it
 * is a floor rather than a target. Raising it needs the same measurement, not
 * an opinion.
 */
export const MIN_SKILLS_FOR_MATCHING = 12;

export interface ProfileCompleteness {
	hasSkills: boolean;
	skillCount: number;
	hasMatchConfig: boolean;
	hasWorkExperience: boolean;
	hasEducation: boolean;
	hasExperienceOrEducation: boolean;
	hasTitle: boolean;
	hasHeadline: boolean;
	hasLocation: boolean;
}

/** Step 1 of Getting Started: enough profile to be matched on. */
export function isProfileReadyForMatching(c: ProfileCompleteness): boolean {
	return c.skillCount >= MIN_SKILLS_FOR_MATCHING && c.hasExperienceOrEducation;
}

/**
 * All four Getting Started steps done.
 *
 * `hasMatches` is step 4, so a fully set-up user does stop seeing the card —
 * for having finished, which is the opposite of the old rule that hid it for
 * having started. See the comment at the call site.
 */
export function isSetupComplete(
	c: ProfileCompleteness,
	hasSearchTasks: boolean,
	hasMatches: boolean
): boolean {
	return isProfileReadyForMatching(c) && c.hasMatchConfig && hasSearchTasks && hasMatches;
}
