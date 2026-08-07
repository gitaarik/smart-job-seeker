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

	// Every string below is verbatim from preview's `unclassified location`
	// bucket — the audit's only real defect count. They are grouped by what was
	// actually wrong, because the fixes are not interchangeable.
	describe('gaps found by auditing real data', () => {
		// Aliases match the WHOLE string, so a country named with any suffix at
		// all fell through. Same shape as the earlier `israel` fix.
		describe('country named with a suffix', () => {
			it.each([
				['UNITED KINGDOM - REMOTE', 'uk'],
				['Virtual UK', 'uk'],
				['Indonesia - Remote', 'asia_pacific'],
				['Manila, Philippines', 'asia_pacific'],
				['Taiwan, Hsinchu', 'asia_pacific'],
				['Seoul, South Korea', 'asia_pacific'],
				['HO CHI MINH CITY, HO CHI MINH CITY, VIETNAM (REMOTE)', 'asia_pacific'],
				['Asia / South East Asia', 'asia_pacific'],
				['Brazil - Remote', 'latin_america'],
				['Brazil; Mexico', 'latin_america'],
				['Home based - EMEA', 'western_europe'],
				['Remote (LATAM, excluding Brazil due to geo-restrictions)', 'latin_america'],
				// Named twice and still missed: the old rule only matched a TRAILING
				// ", china".
				['China, Beijing; China, Shanghai', 'asia_pacific']
			])('%s -> %s', (input, expected) => {
				expect(classifyRegion(input)).toBe(expected);
			});
		});

		// ISO alpha-3 codes arrive as the entire field. These go in as aliases,
		// never as substring patterns — see the negative cases further down.
		describe('bare ISO alpha-3 codes', () => {
			it.each([
				['GBR', 'uk'],
				['CHE', 'western_europe'],
				['ESP', 'western_europe'],
				['ITA', 'western_europe'],
				['ALB', 'eastern_europe'],
				['ARE', 'middle_east'],
				['ISR', 'middle_east'],
				['PHL', 'asia_pacific'],
				['PER', 'latin_america'],
				['KEN', 'africa']
			])('%s -> %s', (input, expected) => {
				expect(classifyRegion(input)).toBe(expected);
			});
		});

		describe('towns and regions with no country attached', () => {
			it.each([
				['Alphen aan den Rijn', 'western_europe'],
				['Amstelveen', 'western_europe'],
				['Hengelo OV', 'western_europe'],
				['Nieuw-Vennep', 'western_europe'],
				['Petten', 'western_europe'],
				['Reeuwijk', 'western_europe'],
				['Schiphol', 'western_europe'],
				['Heidelberg', 'western_europe'],
				['Hauptstraße 65, Binswangen', 'western_europe'],
				['Benelux', 'western_europe'],
				['BRNO-ŽIDENICE, SOUTH MORAVIA', 'eastern_europe'],
				['Hong Kong', 'asia_pacific'],
				['BANGKOK', 'asia_pacific'],
				['Jaipur (Remote + occasional meetups)', 'asia_pacific'],
				['IND - Coimbatore (708)', 'asia_pacific'],
				['IDN, Jakarta', 'asia_pacific'],
				['Rio de Janeiro', 'latin_america'],
				['Uganda', 'africa'],
				['Arizona', 'us'],
				['District of Columbia', 'us'],
				['Remote in Maryland', 'us'],
				// US territories file under `us` — employment law, not longitude.
				['Puerto Rico', 'us'],
				['Guam', 'us'],
				['Gibraltar - Remote', 'uk']
			])('%s -> %s', (input, expected) => {
				expect(classifyRegion(input)).toBe(expected);
			});
		});

		// Continental addresses lead with the postcode ("92130 Issy-les-Moulineaux");
		// US addresses trail with it ("Boston, MA 02101"). The rule is anchored to
		// the start for exactly that reason.
		describe('postcode-first continental addresses', () => {
			it.each([
				['92130 Issy-les-Moulineaux', 'western_europe'],
				['93400 Saint-Ouen', 'western_europe']
			])('%s -> %s', (input, expected) => {
				expect(classifyRegion(input)).toBe(expected);
			});

			it('does not fire on a US address whose ZIP comes last', () => {
				expect(classifyRegion('Boston, MA 02101')).toBe('us');
				expect(classifyRegion('Austin, TX 78701')).toBe('us');
			});
		});

		// The whole reason ISO codes are aliases rather than patterns. Each of
		// these contains a code as a substring and must not be claimed by it.
		describe('short codes never match inside a word', () => {
			it('does not read the verb "are" as the Emirates', () => {
				expect(classifyRegion('Engineers are welcome')).not.toBe('middle_east');
			});

			it('does not read "ken" inside Kensington as Kenya', () => {
				expect(classifyRegion('Kensington, London')).toBe('uk');
			});

			it('does not read "per" inside Performance as Peru', () => {
				expect(classifyRegion('Performance Engineering')).not.toBe('latin_america');
			});

			it('does not read "ind" inside Individual as India', () => {
				expect(classifyRegion('Individual contributor')).not.toBe('asia_pacific');
			});
		});

		// Canada is its own region, not part of a merged "North America" — see the
		// note in REGIONS. Every string here is verbatim from preview.
		describe('Canada', () => {
			it.each([
				['Canada', 'canada'],
				['Canada (Remote)', 'canada'],
				['CAN', 'canada'],
				['Toronto', 'canada'],
				['Toronto, Canada', 'canada'],
				['Montreal, Québec, Canada', 'canada'],
				['Cambridge, Ontario, Canada', 'canada']
			])('%s -> %s', (input, expected) => {
				expect(classifyRegion(input)).toBe(expected);
			});

			// The ordering constraints that make the above safe. Canada sits after
			// `us` and before `uk` in REGIONS, and these are why.
			it('leaves Ontario, California to the US', () => {
				expect(classifyRegion('Ontario, CA')).toBe('us');
			});

			it('leaves Vancouver, Washington to the US', () => {
				expect(classifyRegion('Vancouver, WA')).toBe('us');
			});

			it('does not let the uk london rule claim London, Ontario', () => {
				expect(classifyRegion('London, Ontario, Canada')).toBe('canada');
			});

			it('still gives plain London to the UK', () => {
				expect(classifyRegion('London, UK')).toBe('uk');
			});

			it('does not read "can" inside a word as Canada', () => {
				expect(classifyRegion('Cancún, Mexico')).not.toBe('canada');
			});
		});

		// "Remote US" needed a trailing-country rule. It is word-bounded so that
		// countries merely ENDING in those letters cannot be dragged into the US.
		describe('country last', () => {
			it('classifies Remote US', () => {
				expect(classifyRegion('Remote US')).toBe('us');
			});

			it.each([['Belarus'], ['Aarhus'], ['Minsk, Belarus']])(
				'%s is not claimed by the US',
				(input) => {
					expect(classifyRegion(input)).not.toBe('us');
				}
			);
		});
	});
});
