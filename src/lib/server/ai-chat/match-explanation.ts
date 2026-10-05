/**
 * The summary, strengths and gaps of a match Jev scored, written when someone
 * opens the job rather than when the job was scored.
 *
 * Jev decides the number and writes nothing (match-decisions.ts), so a match it
 * scored is stored without its text, and the job page asks for it once the page
 * is open (api/jobs/[id]/match-explanation). Not from the page's `load`: the app
 * preloads a page's data when a link is hovered, so a list of jobs would have
 * written the text of every job the pointer crossed. Tailoring asks for it too,
 * because it holds a document to the gaps (profile/tailor-version.ts).
 *
 * The text is stored on the row and stays until the job is scored again, which
 * writes the row anew, text included.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { job_matches, jobs, match_config } from '$lib/server/db/schema';
import { relevantSupportingEvidence } from '$lib/server/documents/retrieval';
import { runProfileAiChat } from './job-utils';
import { factorVerdicts, type ScoreFactors } from './match-decisions';
import { type MatchPreferences, matchPromptVariables } from './match-variables';
import { NON_FIT_FIELDS } from './profile-data';

export const EXPLAIN_MATCH_PROMPT = 'explain_job_match';

export interface MatchExplanation {
	summary: string;
	strengths: string[];
	gaps: string[];
}

/**
 * A scored match with no text yet: Jev scored it and nobody has opened it
 * since. The prompt writes its text with the score, and a match the
 * eligibility check stopped is explained by its failures.
 */
export const needsExplanation = (match: {
	skip_reason: string | null;
	match_summary: string | null;
}): boolean => match.skip_reason == null && match.match_summary == null;

const strings = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** The factor verdicts as the prompt shows them, one per line. */
export function factorLines(factors: ScoreFactors | null): string {
	const verdicts = factors ? factorVerdicts(factors) : [];
	return verdicts.length
		? verdicts.map(({ name, verdict }) => `- ${name}: ${verdict}`).join('\n')
		: '- No breakdown was recorded for this score.';
}

/** The job's skills split by whether the match credited the profile with them. */
export function skillsByMatch(
	job: { skills_required: unknown; skills_preferred: unknown },
	matched: unknown
): { shown: string[]; missing: string[] } {
	const shown = strings(matched);
	const credited = new Set(shown.map((skill) => skill.toLowerCase()));
	const asked = [...strings(job.skills_required), ...strings(job.skills_preferred)];
	return { shown, missing: asked.filter((skill) => !credited.has(skill.toLowerCase())) };
}

const NO_PREFERENCES: MatchPreferences = {
	job_types: null,
	experience_levels: null,
	work_location: null,
	locations: null
};

/** Explanations being written in this process, so two requests for one match make one call. */
const writing = new Map<string, Promise<MatchExplanation | null>>();

/**
 * The match's text: the stored one, or a new one written now when the match
 * needs it (needsExplanation). Null when the profile has no match for the job.
 * Throws when the text could not be written.
 */
export function ensureMatchExplanation(
	profileId: number,
	jobId: number
): Promise<MatchExplanation | null> {
	const key = `${profileId}:${jobId}`;
	const running = writing.get(key);
	if (running) return running;
	const work = explain(profileId, jobId).finally(() => writing.delete(key));
	writing.set(key, work);
	return work;
}

async function explain(profileId: number, jobId: number): Promise<MatchExplanation | null> {
	const match = await db.query.job_matches.findFirst({
		where: and(eq(job_matches.profile_id, profileId), eq(job_matches.job_id, jobId))
	});
	if (!match) return null;
	if (!needsExplanation(match)) {
		return {
			summary: match.match_summary ?? '',
			strengths: strings(match.strengths),
			gaps: strings(match.gaps)
		};
	}

	const [job, preferences] = await Promise.all([
		db.query.jobs.findFirst({ where: eq(jobs.id, jobId) }),
		db.query.match_config.findFirst({
			where: eq(match_config.profile_id, profileId),
			columns: { job_types: true, experience_levels: true, work_location: true, locations: true }
		})
	]);
	if (!job) return null;

	const supportingEvidence = await relevantSupportingEvidence(profileId, {
		title: job.title,
		job_description: job.job_description,
		skills_required: strings(job.skills_required)
	});
	const skills = skillsByMatch(job, match.matched_skills);
	const variables = {
		...matchPromptVariables(
			job,
			(preferences as MatchPreferences | undefined) ?? NO_PREFERENCES,
			supportingEvidence
		),
		'match.score': String(match.score),
		'match.factors': factorLines(match.score_factors as ScoreFactors | null),
		'match.matched_skills': skills.shown.join(', ') || 'none',
		'match.missing_skills': skills.missing.join(', ') || 'none'
	};

	const result = await runProfileAiChat<MatchExplanation>(
		profileId,
		EXPLAIN_MATCH_PROMPT,
		variables,
		{ profileDataExclude: NON_FIT_FIELDS }
	);
	if (!result.success || !result.response) {
		throw new Error(`Could not write the match explanation: ${result.message}`, {
			cause: result.cause
		});
	}
	const explanation: MatchExplanation = {
		summary: String(result.response.summary ?? '').trim(),
		strengths: strings(result.response.strengths),
		gaps: strings(result.response.gaps)
	};

	// Only onto the score it explains. A re-score that landed meanwhile wrote
	// the row anew without text, and is explained on the next visit instead.
	await db
		.update(job_matches)
		.set({
			match_summary: explanation.summary,
			strengths: explanation.strengths,
			gaps: explanation.gaps
		})
		.where(
			and(
				eq(job_matches.id, match.id),
				eq(job_matches.score, match.score),
				isNull(job_matches.match_summary)
			)
		);
	return explanation;
}
