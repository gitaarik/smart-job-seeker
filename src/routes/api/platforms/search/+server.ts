import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { or, ilike, asc } from 'drizzle-orm';
import { job_platforms } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';

/**
 * GET /api/platforms/search?url=...
 *
 * Search for existing platforms by URL (domain matching).
 * Returns matching platforms for autocomplete.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	requireAuth(locals);

	const searchUrl = url.searchParams.get('url');
	if (!searchUrl) {
		throw error(400, 'URL parameter required');
	}

	// Extract domain from URL
	let domain: string;
	try {
		const parsed = new URL(searchUrl.startsWith('http') ? searchUrl : `https://${searchUrl}`);
		domain = parsed.hostname.replace(/^www\./, '');
	} catch {
		// If URL parsing fails, use as-is for searching
		domain = searchUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
	}

	// Search for platforms matching the domain
	const platforms = await db.query.job_platforms.findMany({
		where: or(ilike(job_platforms.url, `%${domain}%`), ilike(job_platforms.name, `%${domain}%`)),
		orderBy: asc(job_platforms.name),
		columns: {
			id: true,
			name: true,
			key: true,
			url: true,
			login_page_url: true,
			status: true
		},
		limit: 10
	});

	return json(platforms);
};
