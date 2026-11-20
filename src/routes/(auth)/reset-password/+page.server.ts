import type { PageServerLoad } from './$types';
import { redirectIfAuthenticated } from '#lib/server/auth/guards.ts';

export const load: PageServerLoad = async (event) => {
	redirectIfAuthenticated(event);

	// Get token from URL
	const token = event.url.searchParams.get('token');

	return { token };
};
