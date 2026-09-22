import type { PageServerLoad } from './$types';
import {
	EXPERIENCE_LEVEL_OPTIONS,
	JOB_TYPE_OPTIONS,
	WORK_LOCATION_OPTIONS,
	readMatchPreferences
} from '$lib/server/job/match-preferences';

/**
 * The options and the get-or-create both moved to
 * `$lib/server/job/match-preferences`, which is also what `edit_match_config`
 * holds the model to. They used to be declared here under a comment saying
 * "Keep in sync manually for now"; a third copy behind a capability is what
 * made that worth fixing, because a model offered a value this form does not
 * show writes a preference no job can match.
 */
export const load: PageServerLoad = async ({ parent }) => {
	const { profileId } = await parent();
	const config = await readMatchPreferences(profileId);

	return {
		config,
		options: {
			jobTypes: JOB_TYPE_OPTIONS,
			experienceLevels: EXPERIENCE_LEVEL_OPTIONS,
			workLocationOptions: WORK_LOCATION_OPTIONS
		}
	};
};
