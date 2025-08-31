import { redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/auth';

export async function load({ locals }) {
	if (!locals.user) {
		throw redirect(302, '/auth');
	}

	if (!isAdmin(locals.user)) {
		throw redirect(302, '/dashboard');
	}
}