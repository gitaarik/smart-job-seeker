import type { PageServerLoad } from './$types';
import { redirectIfAuthenticated } from '#lib/server/auth/guards.ts';
import { registrationOpen } from '#lib/server/auth/registration.ts';

export const load: PageServerLoad = async (event) => {
	redirectIfAuthenticated(event, '/home');

	return { registrationOpen: registrationOpen() };
};
