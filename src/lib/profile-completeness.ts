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

/**
 * The vocabulary-reach reading a gap list needs, and no more.
 *
 * Structural rather than `SkillVocabularyReach` itself: that lives in a server
 * module, and this file is imported by the dashboard's client components.
 * Measuring it is `getSkillVocabularyReach`'s job and a query's cost (~110ms on
 * preview's corpus), so it stays with the caller; see the progress page's
 * loader for why a caller should decide when that is worth paying.
 */
export interface SkillReachReading {
	/** reachedJobs / jobsWithSkills as 0-100, or null when nothing to measure. */
	percentage: number | null;
	/** Jobs in scope carrying any skill data at all — the denominator. */
	jobsWithSkills: number;
}

/**
 * Below this, reach is in the empty band.
 *
 * Across preview's profiles reach clusters at 67-76% or at 0-9% with nothing
 * between, so 25 separates the two populations without sitting near either.
 */
export const LOW_SKILL_REACH_PERCENT = 25;

/**
 * Postings in scope below which reach says nothing about the applicant.
 *
 * A brand-new account with four imported jobs should not be told its skills
 * are the problem.
 */
export const MIN_JOBS_FOR_SKILL_REACH = 20;

/**
 * Whether the applicant's skill vocabulary misses the postings they are matched
 * against.
 *
 * The match progress page's banner and the gap list both ask this, which is the
 * reason it lives here: the two would otherwise disagree about the same number
 * the way the two Getting Started callers once did.
 */
export function isSkillReachLow(reach: SkillReachReading | null | undefined): boolean {
	return (
		reach != null &&
		reach.percentage !== null &&
		reach.jobsWithSkills >= MIN_JOBS_FOR_SKILL_REACH &&
		reach.percentage < LOW_SKILL_REACH_PERCENT
	);
}

/** One role, as far as the gap list needs to see it. */
export interface GapRole {
	id: number;
	/** How to name the role to the applicant, e.g. "Nurse at St. Mary's". */
	label: string;
	achievementCount: number;
	/**
	 * Technologies recorded against the role, including those on its projects:
	 * a tool used on a project was used in the role, and asking for it again
	 * would be asking for something the applicant already said.
	 */
	technologyCount: number;
}

/**
 * What the gap list is computed from. Counts, not rows: the list says what is
 * missing, and nothing about what is there beyond whether it is there.
 */
export interface ProfileGapInput {
	skillCount: number;
	/** In the order the profile shows them, which is the order they are asked about. */
	workExperiences: GapRole[];
	educationCount: number;
	sideProjectCount: number;
	certificateCount: number;
	languageCount: number;
	/** Null when the caller did not measure it; then no reach gap is reported. */
	skillReach: SkillReachReading | null;
}

/** Sections whose emptiness is a gap in its own right, most useful first. */
export const GAP_SECTIONS = [
	'work_experience',
	'education',
	'side_project',
	'certificate',
	'language'
] as const;

export type GapSection = (typeof GAP_SECTIONS)[number];

export type ProfileGap =
	| {
			/** Neither a role nor an education entry: the matcher has no history to read. */
			kind: 'no_experience_or_education';
			blocksMatching: true;
	  }
	| {
			kind: 'too_few_skills';
			blocksMatching: true;
			skillCount: number;
			floor: number;
	  }
	| {
			/** The skills there are miss the postings the applicant is matched against. */
			kind: 'low_skill_reach';
			blocksMatching: false;
			percentage: number;
			jobsWithSkills: number;
	  }
	| {
			kind: 'role_without_achievements' | 'role_without_technologies';
			blocksMatching: false;
			roleId: number;
			label: string;
	  }
	| {
			kind: 'empty_section';
			blocksMatching: false;
			section: GapSection;
	  };

/**
 * What is missing from a profile, most worth asking about first.
 *
 * `ProfileCompleteness` can say "you have no education"; this can say "your
 * role at Acme has no achievements recorded". It is computed in code so that
 * whatever acts on it — Getting Started's step 1, or the interview assistant
 * choosing its next question — chooses from a list rather than deciding for
 * itself what is missing (PROFILE-INTERVIEW.md, D2).
 *
 * The order, and why:
 *
 *  1. **What keeps the profile from being matched at all**, by exactly the bar
 *     `isProfileReadyForMatching` draws — no history, then too few skills. The
 *     `blocksMatching` gaps are present precisely when that returns false, so
 *     the interview's stop condition (D5) and this list cannot disagree.
 *  2. **Low vocabulary reach.** Twelve skills nobody posts for have done
 *     nothing, and reach is the signal that says so (D7). It is not a blocker —
 *     the readiness bar is about count and history — but it outranks everything
 *     that is merely thin. Not reported with zero skills: that is
 *     `too_few_skills`, and "0% reach" would say the same thing twice.
 *  3. **Each role's missing achievements, then its missing technologies**,
 *     role by role in the order given. Finishing one role before moving to the
 *     next is how an interview should go (D3), so a role's two gaps sit
 *     together rather than all roles' achievements first.
 *  4. **Empty sections**, in `GAP_SECTIONS` order. Work experience and
 *     education appear here only when the other one exists; with neither, the
 *     blocker in (1) already says it.
 *
 * References and highlights are deliberately not gaps: an empty one costs
 * nothing at matching time, and asking for referees in an interview meant to
 * build a first profile is asking the wrong question at the wrong time.
 */
export function rankProfileGaps(input: ProfileGapInput): ProfileGap[] {
	const gaps: ProfileGap[] = [];
	const hasWork = input.workExperiences.length > 0;
	const hasEducation = input.educationCount > 0;

	if (!hasWork && !hasEducation) {
		gaps.push({ kind: 'no_experience_or_education', blocksMatching: true });
	}
	if (input.skillCount < MIN_SKILLS_FOR_MATCHING) {
		gaps.push({
			kind: 'too_few_skills',
			blocksMatching: true,
			skillCount: input.skillCount,
			floor: MIN_SKILLS_FOR_MATCHING
		});
	}

	const reach = input.skillReach;
	if (input.skillCount > 0 && reach?.percentage != null && isSkillReachLow(reach)) {
		gaps.push({
			kind: 'low_skill_reach',
			blocksMatching: false,
			percentage: reach.percentage,
			jobsWithSkills: reach.jobsWithSkills
		});
	}

	for (const role of input.workExperiences) {
		if (role.achievementCount === 0) {
			gaps.push({
				kind: 'role_without_achievements',
				blocksMatching: false,
				roleId: role.id,
				label: role.label
			});
		}
		if (role.technologyCount === 0) {
			gaps.push({
				kind: 'role_without_technologies',
				blocksMatching: false,
				roleId: role.id,
				label: role.label
			});
		}
	}

	const sectionCounts: Record<GapSection, number> = {
		work_experience: input.workExperiences.length,
		education: input.educationCount,
		side_project: input.sideProjectCount,
		certificate: input.certificateCount,
		language: input.languageCount
	};
	for (const section of GAP_SECTIONS) {
		if (sectionCounts[section] > 0) continue;
		// Said once already, as the blocker.
		if ((section === 'work_experience' || section === 'education') && !hasWork && !hasEducation) {
			continue;
		}
		gaps.push({ kind: 'empty_section', blocksMatching: false, section });
	}

	return gaps;
}
