import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	// Redirect to saved status filter
	const params = new URLSearchParams(url.search);
	params.set('status', 'saved');
	redirect(302, `/jobs?${params.toString()}`);
};
