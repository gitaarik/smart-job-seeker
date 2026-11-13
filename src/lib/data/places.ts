/**
 * A place a user picked from the gazetteer (planning/STRUCTURED-LOCATIONS.md),
 * and the ranking of the picker's suggestions. Shared by the endpoint, the
 * loader and, later, the picker.
 */

export type PlaceKind = 'city' | 'admin' | 'country' | 'region';

/**
 * The whole pick, stored as it is (not only the id), so a reader needs no join
 * and a reload of the gazetteer cannot change what a user chose. "Remote" is
 * never a place: it is a work mode (`work_location`).
 */
export interface Place {
	/** `places.id`: a GeoNames id, or a region's negative one. */
	id: number;
	kind: PlaceKind;
	/** "Haarlem" */
	name: string;
	/** "Haarlem, North Holland, Netherlands", as shown and printed. */
	label: string;
	/** "NL"; null for a region. */
	country: string | null;
	/** ["NL"], or a region's members. */
	countries: string[];
	lat: number | null;
	lon: number | null;
}

/**
 * A place in the match settings' Preferred Locations (`match_config.places`).
 * `radius_km` is how far from it a hybrid or on-site job may be; stored, not
 * read yet (distance is Phase 4), and absent means the place itself: its
 * country for a city, as before.
 */
export interface PreferredPlace extends Place {
	radius_km?: number | null;
}

/**
 * A name as the search compares it: lower case, accents dropped, anything
 * that is not a letter or a digit a single space. "'s-Gravenhage" becomes
 * "s gravenhage", "Zürich" "zurich".
 */
export function foldPlaceName(name: string): string {
	return name
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

/**
 * The `to_tsquery('simple', …)` text for what the user typed: every word as a
 * prefix. Null when nothing searchable is left. Folding leaves letters,
 * digits and spaces only, so nothing in it is tsquery syntax.
 */
export function placeTsQuery(q: string): string | null {
	const words = foldPlaceName(q).split(' ').filter(Boolean);
	return words.length ? words.map((w) => `${w}:*`).join(' & ') : null;
}

/** A search hit before ranking: the place, its folded names (own name first) and population. */
export interface PlaceCandidate {
	place: Place;
	names: string[];
	population: number;
}

const KIND_ORDER: Record<PlaceKind, number> = { country: 0, region: 1, admin: 2, city: 3 };

/**
 * How well a place answers what was typed, lower is better:
 * 0 a name is exactly it ("georgia", "holland", "uk"),
 * 1 its own name starts with it ("ne" → Netherlands),
 * 2 another name starts with it ("den h" → The Hague),
 * 3 only a later word does ("york" → New York).
 * Within a tier the bigger place first, so "ne" offers the Netherlands before
 * Nesodden and "haar" Haarlem before Haarlemmerliede, and at equal size a
 * country before a region, an admin area and a city.
 */
function tier(query: string, names: string[]): number {
	if (names.includes(query)) return 0;
	if (names[0]?.startsWith(query)) return 1;
	if (names.some((n) => n.startsWith(query))) return 2;
	return 3;
}

export function rankPlaces(q: string, candidates: PlaceCandidate[], limit: number): Place[] {
	const query = foldPlaceName(q);
	return candidates
		.map((c) => ({ c, tier: tier(query, c.names) }))
		.sort(
			(a, b) =>
				a.tier - b.tier ||
				b.c.population - a.c.population ||
				KIND_ORDER[a.c.place.kind] - KIND_ORDER[b.c.place.kind]
		)
		.slice(0, limit)
		.map(({ c }) => c.place);
}

/**
 * Preferred Locations as words, for a prompt or a summary: each place's label,
 * then the texts typed before the picker that are not a place yet
 * (`match_config.locations`).
 */
export function preferredLocationTexts(
	places: readonly Place[] | null | undefined,
	texts: unknown
): string[] {
	const typed = Array.isArray(texts) ? texts.map(String).filter((t) => t.trim()) : [];
	return [...(places ?? []).map((p) => p.label), ...typed];
}
