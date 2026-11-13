/**
 * The picker's search over the gazetteer (`places`, planning/STRUCTURED-
 * LOCATIONS.md). Postgres finds the places with a name or a word in a name
 * that starts with each typed word; `rankPlaces` orders them.
 */
import { sql } from 'drizzle-orm';
import { queryRaw } from '$lib/server/db';
import {
	foldPlaceName,
	type Place,
	type PlaceCandidate,
	type PlaceKind,
	placeTsQuery,
	rankPlaces
} from '$lib/data/places';

/**
 * How many hits reach the ranking. "ne" matches thousands; the database hands
 * over the exact names first and then the biggest, which is every place the
 * ranking could put on top.
 */
const CANDIDATES = 200;

interface PlaceRow {
	id: number;
	kind: PlaceKind;
	name: string;
	label: string;
	country_code: string | null;
	countries: string[];
	lat: number | null;
	lon: number | null;
	population: string | number;
	names: string[];
}

export async function searchPlaces(q: string, limit = 8): Promise<Place[]> {
	const tsQuery = placeTsQuery(q);
	if (!tsQuery) return [];
	const folded = foldPlaceName(q);
	const rows = await queryRaw<PlaceRow>(sql`
		SELECT id, kind, name, label, country_code, countries, lat, lon, population, names
		FROM places
		WHERE tsv @@ to_tsquery('simple', ${tsQuery})
		ORDER BY ${folded} = ANY(names) DESC, names[1] LIKE ${folded + '%'} DESC, population DESC
		LIMIT ${CANDIDATES}
	`);
	const candidates: PlaceCandidate[] = rows.map((r) => ({
		place: {
			id: r.id,
			kind: r.kind,
			name: r.name,
			label: r.label,
			country: r.country_code,
			countries: r.countries,
			lat: r.lat,
			lon: r.lon
		},
		names: r.names,
		population: Number(r.population)
	}));
	return rankPlaces(q, candidates, limit);
}
