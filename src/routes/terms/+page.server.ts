import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { loadLegalPage } from '$lib/server/legal/texts';

/** Public, like /pricing: outside `(app)`, so no session is needed to read it. */
export const load: PageServerLoad = async () => {
	const page = await loadLegalPage('terms');
	if (!page) error(404, 'Not published');
	return page;
};
