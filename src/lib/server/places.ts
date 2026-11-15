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

const toPlace = (r: PlaceRow): Place => ({
	id: r.id,
	kind: r.kind,
	name: r.name,
	label: r.label,
	country: r.country_code,
	countries: r.countries,
	lat: r.lat,
	lon: r.lon
});

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
		place: toPlace(r),
		names: r.names,
		population: Number(r.population)
	}));
	return rankPlaces(q, candidates, limit);
}

interface ResolveRow extends PlaceRow {
	admin1: string | null;
	country_names: string[] | null;
	admin_names: string[] | null;
}

/** A typed part as the names compare it, without a leading "the". */
const foldPart = (part: string) => foldPlaceName(part).replace(/^the /, '');

/**
 * Of places with one name, the one a person means: a city before the province
 * of its own name in the same country ("Lisbon", "Utrecht"), then the biggest
 * when it is at least ten times the next ("San Francisco" is California, not
 * Cordoba). Null when it is a real toss-up ("Georgia").
 */
function surest(rows: ResolveRow[]): ResolveRow | null {
	const cities = new Set(rows.filter((r) => r.kind === 'city').map((r) => r.country_code));
	const left = rows
		.filter((r) => !(r.kind === 'admin' && cities.has(r.country_code)))
		.sort((a, b) => Number(b.population) - Number(a.population));
	if (left.length === 1) return left[0];
	if (left.length > 1 && Number(left[0].population) >= 10 * Number(left[1].population)) {
		return left[0];
	}
	return null;
}

/** What a free text names in the gazetteer: the place when it is sure, and what it weighed. */
export interface PlaceResolution {
	place: Place | null;
	/** The places of the first part's name, best first, for a "did you mean". */
	candidates: Place[];
}

/**
 * Read a free text as one place, for a text typed before the picker (the
 * backfill) and for a name the assistant sends. A label as the picker shows it
 * is that place. Otherwise the first part is the name ("Haarlem" of "Haarlem,
 * The Netherlands") and every later part must say where it is: a part of the
 * label, the country's or the province's code ("San Francisco, CA, US"), or
 * any of their names ("Noord-Holland", "Nederland").
 */
export async function resolvePlaceText(text: string): Promise<PlaceResolution> {
	const parts = text
		.split(',')
		.map((p) => foldPart(p))
		.filter(Boolean);
	if (!parts.length) return { place: null, candidates: [] };
	const [head, ...rest] = parts;
	const tsQuery = placeTsQuery(head);
	if (!tsQuery) return { place: null, candidates: [] };
	const rows = await queryRaw<ResolveRow>(sql`
		SELECT p.id, p.kind, p.name, p.label, p.country_code, p.countries, p.lat, p.lon,
			p.population, p.names, p.admin1,
			(SELECT c.names FROM places c
				WHERE c.kind = 'country' AND c.country_code = p.country_code LIMIT 1) AS country_names,
			(SELECT a.names FROM places a
				WHERE a.kind = 'admin' AND a.country_code = p.country_code AND a.admin1 = p.admin1
				LIMIT 1) AS admin_names
		FROM places p
		WHERE p.tsv @@ to_tsquery('simple', ${tsQuery}) AND ${head} = ANY(p.names)
		ORDER BY p.population DESC
		LIMIT 50
	`);
	const fits = (r: ResolveRow, part: string) =>
		r.label.split(',').some((segment) => foldPart(segment) === part) ||
		part === r.country_code?.toLowerCase() ||
		part === r.admin1?.toLowerCase() ||
		!!r.country_names?.includes(part) ||
		!!r.admin_names?.includes(part);
	const named = rows.filter((r) => rest.every((part) => fits(r, part)));
	const best = surest(named);
	return {
		place: best ? toPlace(best) : null,
		candidates: (named.length ? named : rows).slice(0, 5).map(toPlace)
	};
}

/** The gazetteer's row for a country, by its ISO code. */
export async function countryPlace(code: string): Promise<Place | null> {
	const [row] = await queryRaw<PlaceRow>(sql`
		SELECT id, kind, name, label, country_code, countries, lat, lon, population, names
		FROM places WHERE kind = 'country' AND country_code = ${code.toUpperCase()} LIMIT 1
	`);
	return row ? toPlace(row) : null;
}
