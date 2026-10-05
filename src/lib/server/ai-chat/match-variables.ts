/**
 * The variables the matcher's prompts take for one job: `score_job_match`,
 * which scores it, and `explain_job_match`, which explains the score when the
 * job is opened (match-explanation.ts). Jev's score is asked from the same ones
 * (match-decisions.ts), so all three read the job and the preferences alike.
 *
 * `data` and `schema` are deliberately NOT here. The prompts load the profile
 * themselves and render it through renderProfileData (compact JSON, and with
 * the internal `profile_only` markers resolved); passing the raw collected_data
 * string overrode that with the stored PRETTY copy, so 28-33% of the blob was
 * JSON indentation. It also loaded the blob either way, so the override was
 * paying twice in order to send the worse one.
 */
import type { Jobs } from '$lib/server/db/schema';

/** The match settings a profile chose (`match_config`), as far as the prompts show them. */
export interface MatchPreferences {
	job_types: string[] | null;
	experience_levels: string[] | null;
	work_location: string[] | null;
	locations: string[] | null;
}

export type MatchedJob = Pick<
	Jobs,
	| 'title'
	| 'job_poster'
	| 'office_location'
	| 'job_types'
	| 'experience_levels'
	| 'work_location'
	| 'skills_required'
	| 'skills_preferred'
	| 'job_description'
	| 'company_description'
>;

/** One job's variables, with `supportingEvidence` as relevantSupportingEvidence found it. */
export function matchPromptVariables(
	job: MatchedJob,
	preferences: MatchPreferences,
	supportingEvidence: string
): Record<string, string> {
	const listed = (value: unknown, otherwise: string) => (value ? JSON.stringify(value) : otherwise);
	return {
		supportingEvidence,

		'preferences.job_types': listed(preferences.job_types, 'Any'),
		'preferences.experience_levels': listed(preferences.experience_levels, 'Any'),
		'preferences.work_location': listed(preferences.work_location, 'Any'),
		'preferences.locations': listed(preferences.locations, 'Any'),

		'job.title': job.title || 'Unknown',
		'job.job_poster': job.job_poster || 'Unknown',
		'job.office_location': job.office_location || 'Remote/Not specified',
		'job.job_types': listed(job.job_types, 'Not specified'),
		'job.experience_levels': listed(job.experience_levels, 'Not specified'),
		'job.work_location': listed(job.work_location, 'Not specified'),
		'job.skills_required': listed(job.skills_required, 'Not specified'),
		'job.skills_preferred': listed(job.skills_preferred, 'Not specified'),
		'job.job_description': job.job_description || 'No description provided',
		'job.company_description': job.company_description || ''
	};
}
