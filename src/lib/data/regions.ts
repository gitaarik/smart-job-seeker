/**
 * Regions a job is fenced to and a user can pick, as the countries each takes
 * in. One list for both sides: the posting reader (cloud `ats/geo.ts`) reads
 * the name and the aliases out of a location text, and the gazetteer
 * (`scripts/load-places.ts`) loads each region as a `places` row with a fixed
 * id. "Europe" and "EMEA" take in the Netherlands; "LATAM" and "AMER" do not.
 *
 * An id, once loaded, is in users' stored picks: never reuse or renumber one.
 */

const EU = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE';
const EEA = `${EU} IS LI NO`;
const CEE = 'PL CZ SK HU RO BG HR SI EE LV LT RS UA BA ME MK AL MD XK';
const EUROPE = `${EEA} GB CH ${CEE} BY RU AD MC SM VA GI IM JE GG FO`;
const MIDDLE_EAST = 'AE SA QA KW BH OM IL JO LB IQ IR SY YE PS EG TR CY';
const AFRICA =
	'DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ' +
	'ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW';
const LATAM = 'MX GT BZ SV HN NI CR PA CU DO HT PR AR BO BR CL CO EC GY PY PE SR UY VE JM TT BS BB';
const NORTH_AMERICA = 'US CA MX';
const APAC = 'AU NZ JP KR CN HK TW SG MY ID TH VN PH IN PK BD LK NP MM KH LA MN MO BN FJ PG';

export interface Region {
	/** Negative, so it never meets a GeoNames id. */
	id: number;
	name: string;
	/** Other words for it, lower case. */
	aliases: string[];
	/** ISO alpha-2 codes, no duplicates. */
	countries: string[];
}

const region = (id: number, name: string, aliases: string[], codes: string): Region => ({
	id,
	name,
	aliases,
	countries: [...new Set(codes.split(/\s+/))]
});

export const REGIONS: readonly Region[] = [
	region(-1, 'Europe', ['european'], EUROPE),
	region(-2, 'European Union', ['eu'], EU),
	region(-3, 'European Economic Area', ['eea'], EEA),
	region(-4, 'EMEA', [], `${EUROPE} ${MIDDLE_EAST} ${AFRICA}`),
	region(
		-5,
		'Central and Eastern Europe',
		['cee', 'eastern europe', 'central eastern europe'],
		CEE
	),
	region(-6, 'DACH', [], 'DE AT CH'),
	region(-7, 'Benelux', [], 'BE NL LU'),
	region(-8, 'Nordics', ['nordic'], 'DK SE NO FI IS'),
	region(-9, 'MENA', [], `${MIDDLE_EAST} DZ MA TN LY`),
	region(-10, 'Africa', [], AFRICA),
	region(-11, 'Latin America', ['latam', 'south america', 'central america'], LATAM),
	region(-12, 'North America', [], NORTH_AMERICA),
	region(-13, 'Americas', ['amer'], `${NORTH_AMERICA} ${LATAM}`),
	region(-14, 'Asia Pacific', ['apac', 'asia'], APAC),
	region(-15, 'ANZ', [], 'AU NZ')
];
