import type { PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { profiles } from '$lib/server/db/schema';
import {
	EXPERIENCE_LEVEL_OPTIONS,
	JOB_TYPE_OPTIONS,
	WORK_LOCATION_OPTIONS,
	readMatchPreferences
} from '$lib/server/job/match-preferences';
import { BELOW_ASK_TOLERANCE_OPTIONS, countBelowAsk } from '$lib/server/salary/pay-fit-store';
import { storedEmployed, storedFreelance } from '$lib/salary/settings';

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
	const [config, profile, belowAsk] = await Promise.all([
		readMatchPreferences(profileId),
		db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			columns: { salary_employed: true, salary_freelance: true }
		}),
		countBelowAsk(profileId)
	]);

	// The pay card names the asks it compares with, so "below my ask" is never
	// a number the page leaves them to remember.
	const employed = storedEmployed(profile?.salary_employed);
	const freelance = storedFreelance(profile?.salary_freelance);

	return {
		config,
		options: {
			jobTypes: JOB_TYPE_OPTIONS,
			experienceLevels: EXPERIENCE_LEVEL_OPTIONS,
			workLocationOptions: WORK_LOCATION_OPTIONS,
			belowAskTolerances: [...BELOW_ASK_TOLERANCE_OPTIONS]
		},
		asks: {
			employed:
				employed?.amount != null
					? { amount: employed.amount, currency: employed.currency, per: employed.period }
					: null,
			freelance:
				freelance?.amount != null
					? { amount: freelance.amount, currency: freelance.currency, per: freelance.unit }
					: null
		},
		belowAsk
	};
};
