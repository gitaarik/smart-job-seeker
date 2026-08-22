import type { PageServerLoad } from './$types';
import { redirectIfAuthenticated } from '$lib/server/auth/guards';
import { registrationOpen } from '$lib/server/auth/registration';

export const load: PageServerLoad = async (event) => {
	redirectIfAuthenticated(event, '/home');

	return { registrationOpen: registrationOpen() };
};
