import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/auth/guards';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { users } from '$lib/server/db/schema';
import { termsVersion } from '$lib/server/legal/texts';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);

	const userRecord = await db.query.users.findFirst({
		where: eq(users.id, user.id),
		columns: { timezone: true, time_format: true, terms_accepted_at: true, terms_version: true }
	});

	return {
		timezone: userRecord?.timezone ?? null,
		timeFormatRaw: userRecord?.time_format ?? null,
		// The Legal card: where the terms and privacy policy live once the
		// signup page is behind them, and which version this account agreed
		// to. Null when the instance publishes no terms, and the card is not
		// shown. The acceptance is null on accounts the gate never asked
		// (impersonated, demo copies).
		legal: termsVersion()
			? {
					currentVersion: termsVersion()!,
					acceptedVersion: userRecord?.terms_version ?? null,
					acceptedAt: userRecord?.terms_accepted_at ?? null
				}
			: null
	};
};
