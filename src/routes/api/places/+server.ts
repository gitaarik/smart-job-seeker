import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchPlaces } from '$lib/server/places';
import { requireAuth } from '$lib/server/utils/api-helpers';

/**
 * GET /api/places?q=haar[&limit=8]
 *
 * The place picker's suggestions: cities, first-level divisions, countries
 * and regions from the gazetteer, best first (`rankPlaces`). Each is a whole
 * `Place`, ready to store.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	requireAuth(locals);
	const q = (url.searchParams.get('q') ?? '').slice(0, 100);
	const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 8, 1), 20);
	return json({ places: await searchPlaces(q, limit) });
};
