/**
 * Tests for `classifyRegion`.
 *
 * The classifier walks pattern lists in region order (US first, then UK, then
 * Western Europe, …) and returns the first hit. That makes short patterns
 * dangerous: a two-letter US state code matched with `includes` also matches
 * the start of a country name, so ", ne" claimed ", netherlands" and ", de"
 * claimed ", denmark" — every Dutch and Danish job with a country-qualified
 * location was being filed under `us`.
 *
 * The regression cases below pin that class of bug shut, both for the US
 * codes and for the short city names (gent/roma/nice/bern/porto) that would
 * reintroduce it inside Western Europe.
 */
import { describe, expect, it } from 'vitest';
import { classifyRegion } from '../job-taxonomy';

describe('classifyRegion', () => {
	it('returns null for empty input', () => {
		expect(classifyRegion(null)).toBeNull();
		expect(classifyRegion(undefined)).toBeNull();
		expect(classifyRegion('')).toBeNull();
		expect(classifyRegion('   ')).toBeNull();
	});

	it('strips work-arrangement suffixes before matching', () => {
		expect(classifyRegion('Amsterdam (Remote)')).toBe('western_europe');
		expect(classifyRegion('Austin, TX (Hybrid)')).toBe('us');
	});

	describe('US state codes match as whole tokens', () => {
		it.each([
			['Austin, TX', 'us'],
			['Boston, MA 02101', 'us'],
			['Portland, OR', 'us'],
			['Washington, DC', 'us'],
			['San Francisco, CA', 'us'],
			['Denver, CO', 'us'],
			['New York, NY', 'us'],
			['Seattle, WA', 'us'],
			['Chicago, IL', 'us'],
			['Omaha, NE', 'us']
		])('%s -> %s', (input, want) => {
			expect(classifyRegion(input)).toBe(want);
		});

		// Each of these used to be swallowed by a US state-code prefix.
		it.each([
			['Amsterdam, Netherlands', 'western_europe'],
			['Rotterdam, Netherlands', 'western_europe'],
			['Copenhagen, Denmark', 'western_europe'],
			['Riga, Latvia', 'eastern_europe'],
			['Mumbai, India', 'asia_pacific'],
			['Mexico City, Mexico', 'latin_america']
		])("%s is not US — it's %s", (input, want) => {
			expect(classifyRegion(input)).toBe(want);
		});
	});

	describe('Western European cities', () => {
		it.each([
			'Copenhagen',
			'Aarhus',
			'Stockholm',
			'Gothenburg',
			'Malmö',
			'Oslo',
			'Bergen',
			'Helsinki',
			'Reykjavik',
			'Dublin',
			'Vienna',
			'Zurich',
			'Geneva',
			'Brussels',
			'Ghent',
			'Antwerp',
			'Lisbon',
			'Porto',
			'Milan',
			'Roma',
			'Athens',
			'Nice',
			'Luxembourg',
			'Leipzig',
			'Bordeaux'
		])('%s -> western_europe', (city) => {
			expect(classifyRegion(city)).toBe('western_europe');
		});

		// Short city patterns must not match inside longer, unrelated names.
		it.each([
			['Buenos Aires, Argentina', 'latin_america'], // "gent" in Argentina
			['Bucharest, Romania', 'eastern_europe'], // "roma" in Romania
			['Porto Alegre, Brazil', 'latin_america'] // Porto, but Brazilian
		])('%s -> %s', (input, want) => {
			expect(classifyRegion(input)).toBe(want);
		});

		it('still matches a city inside a longer string', () => {
			expect(classifyRegion('Venice, Italy')).toBe('western_europe');
		});
	});

	describe('other regions are unaffected', () => {
		it.each([
			['London, UK', 'uk'],
			['Berlin, Germany', 'western_europe'],
			['Warsaw, Poland', 'eastern_europe'],
			['Dubai, UAE', 'middle_east'],
			['Singapore', 'asia_pacific']
		])('%s -> %s', (input, want) => {
			expect(classifyRegion(input)).toBe(want);
		});
	});

	it("returns null for something it can't place", () => {
		expect(classifyRegion('Somewhere Nice-ish')).not.toBe('us');
		expect(classifyRegion('qwertyville')).toBeNull();
	});

	// Every string below is a real office_location that was landing unclassified
	// on preview. Kept verbatim rather than idealised, because the shapes are the
	// point: bare Dutch towns, "<street> <nr>, <postcode> <city>", all-caps site
	// codes, and countries named inside a longer string.
	describe('locations that used to fall through to null', () => {
		it.each([
			// Dutch postcode + city, with and without a street prefix
			['2215 Voorhout', 'western_europe'],
			['7600 Almelo', 'western_europe'],
			['Hanzelaan 95, 8017 Zwolle', 'western_europe'],
			['Betuwehaven 8, 3433 Nieuwegein', 'western_europe'],
			['Rivium Quadrant 2, 2909 Capelle aan den IJssel', 'western_europe'],
			// Bare Dutch towns
			['Nieuwegein', 'western_europe'],
			['Coevorden', 'western_europe'],
			['De Rijp', 'western_europe'],
			['Prismastraat 4, Nootdorp', 'western_europe'],
			// Country named inside the string — an alias only ever matched the whole
			// string, so these named their country and still got null
			['Rotterdam, Netherlands', 'western_europe'],
			['Ramat Gan, Israel', 'middle_east'],
			['Israel, Yokneam', 'middle_east'],
			// All-caps site codes
			['POL - PM - GDANSK', 'eastern_europe'],
			['CRAIOVA (REMOTE)', 'eastern_europe'],
			// ISO alpha-3, exact match only
			['AUS', 'asia_pacific'],
			['IND', 'asia_pacific'],
			// US cities — the list had states but no cities
			['San Francisco', 'us'],
			['Boston or Remote', 'us'],
			// "US - Remote" forms: the suffix strip only removes a parenthesised
			// "(Remote)", so these arrived as "us - remote" and matched no alias
			['US Remote', 'us'],
			['US - REMOTE (REMOTE)', 'us'],
			['BOSTON - USA (REMOTE)', 'us']
		])('%s -> %s', (input, want) => {
			expect(classifyRegion(input)).toBe(want);
		});

		// The `^us\b` and `\busa\b` rules are two letters from being a repeat of
		// the original bug, so pin the words they must not claim.
		it.each([
			['Uster, Switzerland', 'western_europe'],
			['Ushuaia, Argentina', 'latin_america']
		])('%s is not claimed by the US rules', (input, want) => {
			expect(classifyRegion(input)).toBe(want);
		});
	});

	// The postcode rule is the one most able to go greedy: "<4 digits> <word>"
	// also describes a US street address. It is anchored to the end of the
	// string, so a US address — which continues past the city with a comma —
	// cannot reach it.
	describe('the Dutch postcode rule does not swallow US addresses', () => {
		// The assertion that matters is "not Western Europe". Some of these are
		// legitimately `us` on a city or state match — "Washington" is a US state —
		// and pinning an exact value here would be testing those patterns, not this
		// rule.
		it.each([
			['1200 Main Street, Springfield'],
			['1600 Pennsylvania Avenue, Washington'],
			['350 Fifth Avenue, New York, NY'],
			['Austin, TX 78701'],
			['4200 Some Boulevard, Phoenix, AZ']
		])('%s is not claimed by Western Europe', (input) => {
			expect(classifyRegion(input)).not.toBe('western_europe');
		});

		it('leaves a bare US street address unclassified rather than European', () => {
			expect(classifyRegion('1200 Main Street, Springfield')).toBeNull();
		});
	});
});
