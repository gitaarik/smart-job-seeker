import type { PageServerLoad } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { profiles, users } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ parent }) => {
	const { profileId, user } = await parent();

	const [profile, userRecord] = await Promise.all([
		db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			columns: {
				email_digest_enabled: true,
				email_digest_frequency_days: true,
				email_digest_min_score: true,
				email_digest_last_sent_at: true,
				email_digest_preferred_hour: true,
				email_digest_send_to: true,
				email_address: true,
				location_timezone: true,
				browser_timezone: true
			}
		}),
		db.query.users.findFirst({
			where: eq(users.id, user.id),
			columns: { timezone: true, email: true }
		})
	]);

	// Only use timezone values that are valid IANA identifiers
	function isValidTimezone(tz: string | null | undefined): tz is string {
		if (!tz) return false;
		try {
			Intl.DateTimeFormat(undefined, { timeZone: tz });
			return true;
		} catch {
			return false;
		}
	}

	const timezone =
		[userRecord?.timezone, profile?.location_timezone, profile?.browser_timezone].find(
			isValidTimezone
		) ?? null;

	return {
		emailDigest: {
			enabled: profile?.email_digest_enabled ?? false,
			frequency_days: profile?.email_digest_frequency_days ?? 7,
			min_score: profile?.email_digest_min_score ?? 70,
			preferred_hour: profile?.email_digest_preferred_hour ?? 9,
			send_to: profile?.email_digest_send_to ?? 'profile',
			last_sent_at: profile?.email_digest_last_sent_at?.toISOString() ?? null,
			email_address: profile?.email_address ?? null,
			timezone,
			account_email: userRecord?.email ?? user.email
		}
	};
};
