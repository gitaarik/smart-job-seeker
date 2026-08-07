import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth/better-auth';

export const load: PageServerLoad = async (event) => {
	// Sign out the user
	if (event.locals.session) {
		await auth.api.signOut({
			headers: event.request.headers
		});
	}

	// Redirect to home
	redirect(302, '/');
};
