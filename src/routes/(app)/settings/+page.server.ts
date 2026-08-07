import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/server/auth/guards';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { users } from '$lib/server/db/schema';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);

	const userRecord = await db.query.users.findFirst({
		where: eq(users.id, user.id),
		columns: { timezone: true, time_format: true }
	});

	return {
		timezone: userRecord?.timezone ?? null,
		timeFormatRaw: userRecord?.time_format ?? null
	};
};
