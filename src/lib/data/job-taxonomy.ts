/**
 * Centralized job taxonomy: canonical types, aliases, and multilingual variants.
 *
 * This is the SINGLE SOURCE OF TRUTH for job type, work location, and experience
 * level classifications. All normalization, display labeling, and SQL filter
 * expansion should derive from this file.
 *
 * Consumers:
 *   - format.ts (UI display labels)
 *   - matcher.ts (in-memory normalization for matching)
 *   - eligibility.ts (SQL filter expansion)
 *   - config/+page.server.ts (match preference options)
 *
 * To add a new alias or language variant, add it here. All consumers pick it up
 * automatically.
 */

// ============================================================================
// Types
// ============================================================================

interface Alias {
	/** The original human-readable form, lowercased. E.g. "nach absprache" */
	text: string;
	/** Optional custom display label. If omitted, the canonical value's label is used.
	 *  E.g. "contractor" displays as "Contractor", not "Contract". */
	displayLabel?: string;
}

interface Pattern {
	/** The substring, prefix, or (for mode "regex") source pattern to match */
	pattern: string;
	/**
	 * "includes" for substring match, "startsWith" for prefix match, "regex" for
	 * a full regular expression.
	 *
	 * Reach for "regex" when a short pattern would otherwise match inside a
	 * longer word — two-letter US state codes are the motivating case, where a
	 * plain `includes` of ", ne" also matches ", netherlands". Only the region
	 * classifier evaluates this mode; `buildNormalizer` skips it.
	 */
	mode: 'includes' | 'startsWith' | 'regex';
}

interface CanonicalValue {
	/** The canonical identifier, e.g. "contract", "hybrid" */
	canonical: string;
	/** The default display label, e.g. "Contract", "Hybrid" */
	label: string;
	/** Exact-match aliases (lowercased) that map to this canonical value */
	aliases: Alias[];
	/** Substring/prefix patterns for fuzzy matching (evaluated after exact match) */
	patterns?: Pattern[];
}

export interface TaxonomyCategory {
	values: CanonicalValue[];
}

// ============================================================================
// Job Types
// ============================================================================

export const JOB_TYPES: TaxonomyCategory = {
	values: [
		{
			canonical: 'full_time',
			label: 'Full-time',
			aliases: [
				{ text: 'full_time' },
				{ text: 'full-time' },
				{ text: 'fulltime' },
				{ text: 'permanent', displayLabel: 'Permanent' },
				// Dutch
				{ text: 'voltijd' },
				{ text: 'vast contract' },
				// German
				{ text: 'vollzeit' },
				{ text: 'festanstellung' },
				// French
				{ text: 'temps plein' },
				{ text: 'cdi' },
				// Spanish
				{ text: 'tiempo completo' },
				{ text: 'jornada completa' }
			]
		},
		{
			canonical: 'part_time',
			label: 'Part-time',
			aliases: [
				{ text: 'part_time' },
				{ text: 'part-time' },
				{ text: 'parttime' },
				// Dutch
				{ text: 'deeltijd' },
				// German
				{ text: 'teilzeit' },
				// French
				{ text: 'temps partiel' },
				// Spanish
				{ text: 'tiempo parcial' },
				{ text: 'media jornada' }
			]
		},
		{
			canonical: 'contract',
			label: 'Contract',
			aliases: [
				{ text: 'contract' },
				{ text: 'one-time project' },
				{ text: 'one time project' },
				{ text: 'contractor', displayLabel: 'Contractor' },
				{ text: 'freelance', displayLabel: 'Freelance' },
				{ text: 'fixed-price' },
				{ text: 'hourly' },
				{ text: 'hourly contract' },
				{ text: 'temporary', displayLabel: 'Temporary' },
				{ text: 'temp-to-hire', displayLabel: 'Temp to Hire' },
				{ text: 'ftc' },
				{ text: 'freelance contract' },
				{ text: 'contractor assignment freelancer' },
				// Dutch
				{ text: 'zzp', displayLabel: 'ZZP' },
				{ text: 'freelance opdracht' },
				{ text: 'tijdelijk', displayLabel: 'Tijdelijk' },
				{ text: 'detachering', displayLabel: 'Detachering' },
				// German
				{ text: 'freiberuflich', displayLabel: 'Freiberuflich' },
				{ text: 'zeitarbeit', displayLabel: 'Zeitarbeit' },
				{ text: 'befristet' },
				// French
				{ text: 'cdd' },
				{ text: 'mission' },
				{ text: 'intérim', displayLabel: 'Intérim' },
				// Spanish
				{ text: 'autónomo', displayLabel: 'Autónomo' },
				{ text: 'temporal', displayLabel: 'Temporal' },
				{ text: 'por proyecto' }
			],
			patterns: [
				{ pattern: 'freelance', mode: 'includes' },
				{ pattern: 'contractor', mode: 'includes' }
			]
		},
		{
			canonical: 'internship',
			label: 'Internship',
			aliases: [
				{ text: 'internship' },
				{ text: 'intern' },
				// Dutch
				{ text: 'stage' },
				{ text: 'stagiair' },
				// German
				{ text: 'praktikum' },
				// French
				{ text: 'stage', displayLabel: 'Stage' },
				// Spanish
				{ text: 'prácticas' },
				{ text: 'pasantía' }
			]
		}
	]
};

// ============================================================================
// Work Locations
// ============================================================================

export const WORK_LOCATIONS: TaxonomyCategory = {
	values: [
		{
			canonical: 'remote',
			label: 'Remote',
			aliases: [
				{ text: 'remote' },
				{ text: 'fully remote' },
				{ text: 'remote (no onsite)' },
				{ text: 'work from home' },
				// "Worldwide" and "Anywhere" name a work arrangement, not a place. They
				// were the single largest group of jobs with an unclassifiable
				// office_location — 804 rows of "Worldwide" on preview alone.
				{ text: 'worldwide' },
				{ text: 'wereldwijd' },
				{ text: 'anywhere' },
				// Dutch. "thuiswerk"/"thuiswerken" were here; "werk van thuis" is the
				// more common phrasing and was not, which left 326 rows unreadable.
				{ text: 'thuiswerk' },
				{ text: 'thuiswerken' },
				{ text: 'werk van thuis' },
				{ text: 'werken van thuis' },
				// German
				{ text: 'homeoffice' },
				{ text: 'home office' },
				// French
				{ text: 'télétravail' },
				// Spanish
				{ text: 'teletrabajo' },
				{ text: 'remoto' },
				// Company-speak for the same thing
				{ text: 'distributed' }
			],
			patterns: [
				{ pattern: 'remote', mode: 'startsWith' },
				// "Thuiswerk in Nederland" and friends
				{ pattern: 'thuiswerk', mode: 'startsWith' },
				{ pattern: 'werk van thuis', mode: 'startsWith' },
				// Forms that say remote without leading with the word, so neither the
				// exact alias nor the startsWith above could see them: "100% Remote",
				// "Work fully remote, globally", "Home based - EMEA".
				{ pattern: '% remote', mode: 'includes' },
				{ pattern: 'fully remote', mode: 'includes' },
				{ pattern: 'home based', mode: 'includes' }
			]
		},
		{
			canonical: 'hybrid',
			label: 'Hybrid',
			aliases: [
				{ text: 'hybrid' },
				{ text: 'hybride' },
				// Dutch
				{ text: 'in overleg' },
				// English
				{ text: 'flexible' },
				{ text: 'negotiable' },
				{ text: 'by agreement' },
				{ text: 'by mutual agreement' },
				{ text: 'by arrangement' },
				// German
				{ text: 'nach absprache' },
				{ text: 'nach vereinbarung' },
				{ text: 'flexibel' },
				// French
				{ text: 'en concertation' },
				{ text: 'selon accord' },
				{ text: 'à convenir' },
				{ text: 'à définir' },
				{ text: 'en accord' },
				// Spanish
				{ text: 'a convenir' },
				{ text: 'según acuerdo' },
				{ text: 'negociable' },
				// Portuguese
				{ text: 'a combinar' },
				{ text: 'a negociar' }
			],
			patterns: [{ pattern: 'hybrid', mode: 'includes' }]
		},
		{
			canonical: 'onsite',
			label: 'On-site',
			aliases: [
				{ text: 'onsite' },
				{ text: 'on-site' },
				{ text: 'on_site' },
				{ text: 'on site' },
				// Consultancy phrasing — the site is the client's, but it is on-site.
				{ text: 'customer site' },
				{ text: 'client site' },
				// German
				{ text: 'vor ort' },
				// French
				{ text: 'sur site' },
				{ text: 'sur place' },
				// Spanish
				{ text: 'presencial' },
				// Dutch
				{ text: 'op locatie' }
			]
		}
	]
};

// ============================================================================
// Experience Levels
// ============================================================================

export const EXPERIENCE_LEVELS: TaxonomyCategory = {
	values: [
		{
			canonical: 'entry',
			label: 'Entry Level',
			aliases: [
				{ text: 'entry' },
				{ text: 'entry_level' },
				{ text: 'entry-level' },
				{ text: 'entry level' }
			]
		},
		{
			canonical: 'junior',
			label: 'Junior',
			aliases: [{ text: 'junior' }]
		},
		{
			canonical: 'mid',
			label: 'Mid Level',
			aliases: [
				{ text: 'mid' },
				{ text: 'mid_level' },
				{ text: 'mid-level' },
				{ text: 'mid level' },
				{ text: 'medior' }
			]
		},
		{
			canonical: 'mid_senior',
			label: 'Mid-Senior',
			aliases: [{ text: 'mid_senior' }, { text: 'mid-senior' }, { text: 'mid senior' }]
		},
		{
			canonical: 'senior',
			label: 'Senior',
			aliases: [{ text: 'senior' }]
		},
		{
			canonical: 'lead',
			label: 'Lead',
			aliases: [{ text: 'lead' }]
		},
		{
			canonical: 'principal',
			label: 'Principal',
			aliases: [{ text: 'principal' }]
		},
		{
			canonical: 'staff',
			label: 'Staff',
			aliases: [{ text: 'staff' }]
		},
		{
			canonical: 'director',
			label: 'Director',
			aliases: [{ text: 'director' }]
		},
		{
			canonical: 'executive',
			label: 'Executive',
			aliases: [{ text: 'executive' }]
		},
		{
			canonical: 'internship',
			label: 'Internship',
			aliases: [{ text: 'internship' }]
		}
	]
};

// ============================================================================
// Regions
// ============================================================================

export const REGIONS: TaxonomyCategory = {
	values: [
		{
			canonical: 'us',
			label: 'US',
			aliases: [
				{ text: 'us' },
				{ text: 'usa' },
				{ text: 'united states' },
				{ text: 'united states of america' }
			],
			patterns: [
				// US state/territory codes after a comma, as a WHOLE token:
				// "Austin, TX", "Boston, MA 02101", "Portland, OR". The trailing \\b is
				// what keeps ", ne" from matching ", netherlands" and ", de" from
				// matching ", denmark" — a plain substring match classified every
				// country whose name starts with a state code as US.
				{
					pattern:
						',\\s*(?:a[klrz]|c[aot]|d[ce]|fl|ga|hi|i[adln]|k[sy]|la|m[adeinost]|n[cdehjmvy]|o[hkr]|pa|ri|s[cd]|t[nx]|ut|v[at]|w[aivy])\\b',
					mode: 'regex'
				},
				{ pattern: ', usa', mode: 'includes' },
				// Full state names and major cities without state abbrev
				{ pattern: 'texas', mode: 'includes' },
				{ pattern: 'california', mode: 'includes' },
				{ pattern: 'new york', mode: 'includes' },
				{ pattern: 'florida', mode: 'includes' },
				{ pattern: 'virginia', mode: 'includes' },
				{ pattern: 'washington', mode: 'includes' },
				{ pattern: 'colorado', mode: 'includes' },
				{ pattern: 'massachusetts', mode: 'includes' },
				{ pattern: 'illinois', mode: 'includes' },
				{ pattern: 'north america', mode: 'includes' },
				{ pattern: 'united states', mode: 'includes' },
				// Major US cities. There were state names here but no city names, so a
				// bare "San Francisco" or "Boston" classified as nothing at all.
				// Deliberately omitting names that are equally a UK city — Birmingham,
				// Manchester, Cambridge — since those would be a coin flip.
				{
					pattern:
						'\\b(san francisco|boston|chicago|seattle|austin|denver|atlanta|los angeles|san diego|san jose|philadelphia|phoenix|dallas|houston|miami|minneapolis|detroit|baltimore|pittsburgh|nashville)\\b',
					mode: 'regex'
				},
				// "US Remote", "US - Remote", "BOSTON - USA (REMOTE)". The suffix strip
				// only removes a parenthesised "(Remote)", so these arrived as
				// "us - remote" and matched no alias. Word-bounded so that "us" cannot
				// claim "Uster" and "usa" cannot claim "usability".
				{ pattern: '^us\\b', mode: 'regex' },
				{ pattern: '\\busa\\b', mode: 'regex' },
				// The mirror of the above: "Remote US" puts the country last. Anchored
				// to the end and word-bounded, so "Belarus" and "Aarhus" cannot match —
				// neither has a boundary before the "us".
				{ pattern: '\\bus$', mode: 'regex' },
				// More full state names, in the same spirit as the block above.
				{ pattern: 'arizona', mode: 'includes' },
				{ pattern: 'maryland', mode: 'includes' },
				{ pattern: 'district of columbia', mode: 'includes' },
				// Territories. Puerto Rico and Guam file under US for hiring purposes —
				// US employment law, no visa for US citizens — even though Guam sits in
				// the Pacific. Filed by who can take the job, not by longitude.
				{ pattern: 'puerto rico', mode: 'includes' },
				{ pattern: 'guam', mode: 'includes' }
			]
		},
		{
			// Canada is its own region rather than part of a merged "North America".
			// `region` is not a geography label — it keys REGION_CURRENCIES, and USD
			// is not CAD, so a merged bucket has no correct currency. It is also a
			// separate labour market, exactly like the uk/western_europe split below.
			// The UI is free to present "North America" as us OR canada; that grouping
			// is recoverable, whereas a merged value is not.
			//
			// ORDER MATTERS: this sits AFTER `us` on purpose. "Ontario, CA" is Ontario,
			// California and "Vancouver, WA" is in Washington state — both are caught by
			// the US state-code rule above before anything here can claim them. It sits
			// BEFORE `uk` for the mirror reason: "London, Ontario, Canada" must not be
			// taken by the uk `london` pattern.
			canonical: 'canada',
			label: 'Canada',
			aliases: [
				{ text: 'canada' },
				// ISO alpha-3, exact-match only.
				{ text: 'can' }
			],
			patterns: [
				{ pattern: 'canada', mode: 'includes' },
				{ pattern: 'toronto', mode: 'includes' },
				{ pattern: 'montreal', mode: 'includes' },
				{ pattern: 'montréal', mode: 'includes' },
				{ pattern: 'vancouver', mode: 'includes' },
				{ pattern: 'ottawa', mode: 'includes' },
				{ pattern: 'calgary', mode: 'includes' },
				{ pattern: 'edmonton', mode: 'includes' },
				{ pattern: 'winnipeg', mode: 'includes' },
				// Provinces, comma-prefixed. A bare "ontario" would collide with
				// Ontario, California — the comma is what makes these safe.
				{ pattern: ', ontario', mode: 'includes' },
				{ pattern: ', quebec', mode: 'includes' },
				{ pattern: ', québec', mode: 'includes' },
				{ pattern: ', british columbia', mode: 'includes' },
				{ pattern: ', alberta', mode: 'includes' },
				{ pattern: ', nova scotia', mode: 'includes' }
			]
		},
		{
			canonical: 'uk',
			label: 'UK',
			aliases: [
				{ text: 'uk' },
				{ text: 'united kingdom' },
				{ text: 'great britain' },
				{ text: 'england' },
				{ text: 'scotland' },
				{ text: 'wales' },
				{ text: 'northern ireland' },
				// ISO alpha-3. Exact-match only, so this cannot claim a substring.
				{ text: 'gbr' },
				// British Overseas Territory — hires under UK terms.
				{ text: 'gibraltar' }
			],
			patterns: [
				{ pattern: ', uk', mode: 'includes' },
				// "UNITED KINGDOM - REMOTE" and "Virtual UK" name the country outright
				// but matched neither the exact alias nor ", uk".
				{ pattern: 'united kingdom', mode: 'includes' },
				{ pattern: 'virtual uk', mode: 'includes' },
				{ pattern: 'gibraltar', mode: 'includes' },
				{ pattern: 'london', mode: 'includes' },
				{ pattern: 'manchester', mode: 'includes' },
				{ pattern: 'birmingham, uk', mode: 'includes' },
				{ pattern: 'edinburgh', mode: 'includes' },
				{ pattern: 'bristol, uk', mode: 'includes' },
				{ pattern: 'cambridge, uk', mode: 'includes' },
				{ pattern: 'oxford, uk', mode: 'includes' },
				{ pattern: 'leeds, uk', mode: 'includes' },
				{ pattern: 'cardiff', mode: 'includes' },
				{ pattern: 'in uk', mode: 'includes' }
			]
		},
		{
			canonical: 'western_europe',
			label: 'Western Europe',
			aliases: [
				{ text: 'western europe' },
				{ text: 'europe' },
				{ text: 'european union' },
				{ text: 'eu' },
				{ text: 'eea' },
				{ text: 'emea' },
				// Countries
				{ text: 'netherlands' },
				{ text: 'nederland' },
				{ text: 'germany' },
				{ text: 'deutschland' },
				{ text: 'france' },
				{ text: 'belgium' },
				{ text: 'belgië' },
				{ text: 'belgique' },
				{ text: 'austria' },
				{ text: 'österreich' },
				{ text: 'switzerland' },
				{ text: 'schweiz' },
				{ text: 'suisse' },
				{ text: 'ireland' },
				{ text: 'luxembourg' },
				{ text: 'denmark' },
				{ text: 'dnk' },
				{ text: 'danmark' },
				{ text: 'sweden' },
				{ text: 'sverige' },
				{ text: 'norway' },
				{ text: 'norge' },
				{ text: 'finland' },
				{ text: 'suomi' },
				{ text: 'iceland' },
				{ text: 'ísland' },
				{ text: 'nordics' },
				{ text: 'scandinavia' },
				{ text: 'spain' },
				{ text: 'españa' },
				{ text: 'portugal' },
				{ text: 'italy' },
				{ text: 'italia' },
				{ text: 'greece' },
				// Multi-country shorthand seen in real postings.
				{ text: 'benelux' },
				// ISO alpha-3. Exact-match only — safe here, unsafe as a substring
				// pattern ("ita" and "che" both sit inside ordinary words).
				{ text: 'che' },
				{ text: 'esp' },
				{ text: 'ita' }
			],
			patterns: [
				// Dutch provinces and cities
				{ pattern: 'noord-holland', mode: 'includes' },
				{ pattern: 'zuid-holland', mode: 'includes' },
				{ pattern: 'noord-brabant', mode: 'includes' },
				{ pattern: 'gelderland', mode: 'includes' },
				{ pattern: 'limburg', mode: 'includes' },
				{ pattern: 'utrecht', mode: 'includes' },
				{ pattern: 'amsterdam', mode: 'includes' },
				{ pattern: 'rotterdam', mode: 'includes' },
				{ pattern: 'den haag', mode: 'includes' },
				{ pattern: 'eindhoven', mode: 'includes' },
				{ pattern: 'groningen', mode: 'includes' },
				{ pattern: 'haarlem', mode: 'includes' },
				{ pattern: 'leiden', mode: 'includes' },
				{ pattern: 'delft', mode: 'includes' },
				{ pattern: 'hilversum', mode: 'includes' },
				{ pattern: 'amersfoort', mode: 'includes' },
				{ pattern: 'breda', mode: 'includes' },
				{ pattern: 'tilburg', mode: 'includes' },
				{ pattern: 'arnhem', mode: 'includes' },
				{ pattern: 'nijmegen', mode: 'includes' },
				{ pattern: 'den bosch', mode: 'includes' },
				{ pattern: 'hybride werken', mode: 'includes' },
				// More Dutch towns, from locations that were landing unclassified:
				// "Nieuwegein", "Coevorden", "De Rijp". Word-bounded rather than plain
				// substring — "tiel" and "weert" are short enough to appear inside
				// unrelated words, and over-eager substring matching is exactly what
				// put every Dutch job under `us` in the first place.
				{
					pattern:
						'\\b(nieuwegein|driebergen|coevorden|tiel|flevoland|de rijp|venray|drunen|schagen|veldhoven|beverwijk|nootdorp|abcoude|zwijndrecht|hoofddorp|woubrugge|nijkerk|weert|almelo|voorhout|zwolle|capelle aan den ijssel)\\b',
					mode: 'regex'
				},
				// Dutch address format: "<street> <nr>, <4-digit postcode> <city>", or
				// just "<postcode> <city>" — e.g. "2215 Voorhout", "Hanzelaan 95, 8017
				// Zwolle". Anchored to the END of the string, which is what keeps a US
				// street address out: "1200 Main Street, Springfield" has a comma after
				// the number, so [a-z\s]*$ cannot reach the end and it does not match.
				{
					pattern: '(^|,\\s*)[0-9]{4}\\s+[a-z][a-z\\s]*$',
					mode: 'regex'
				},
				// Country names as substrings, not just exact aliases. "Netherlands"
				// alone matched; "Rotterdam, Netherlands" did not, because aliases are
				// compared against the whole string. Long enough to be unambiguous.
				{
					pattern:
						'\\b(netherlands|nederland|germany|deutschland|belgium|belgië|denmark|danmark|sweden|norway|finland|ireland|austria|switzerland|portugal)\\b',
					mode: 'regex'
				},
				// German cities
				{ pattern: 'berlin', mode: 'includes' },
				{ pattern: 'münchen', mode: 'includes' },
				{ pattern: 'munich', mode: 'includes' },
				{ pattern: 'frankfurt', mode: 'includes' },
				{ pattern: 'hamburg', mode: 'includes' },
				{ pattern: 'köln', mode: 'includes' },
				{ pattern: 'cologne', mode: 'includes' },
				{ pattern: 'düsseldorf', mode: 'includes' },
				{ pattern: 'stuttgart', mode: 'includes' },
				// French cities
				{ pattern: 'paris', mode: 'includes' },
				{ pattern: 'lyon', mode: 'includes' },
				{ pattern: 'marseille', mode: 'includes' },
				// Spanish regions and cities
				{ pattern: 'spain', mode: 'includes' },
				{ pattern: 'andalusia', mode: 'includes' },
				{ pattern: 'catalonia', mode: 'includes' },
				{ pattern: 'madrid', mode: 'includes' },
				{ pattern: 'barcelona', mode: 'includes' },
				{ pattern: 'málaga', mode: 'includes' },
				{ pattern: 'malaga', mode: 'includes' },
				{ pattern: 'marbella', mode: 'includes' },
				{ pattern: 'cadiz', mode: 'includes' },
				{ pattern: 'granada', mode: 'includes' },
				{ pattern: 'valencia', mode: 'includes' },
				{ pattern: 'seville', mode: 'includes' },
				{ pattern: 'sevilla', mode: 'includes' },
				{ pattern: 'estepona', mode: 'includes' },
				{ pattern: 'fuengirola', mode: 'includes' },
				{ pattern: 'mijas', mode: 'includes' },
				{ pattern: 'torremolinos', mode: 'includes' },
				{ pattern: 'benalmádena', mode: 'includes' },
				{ pattern: 'benalmadena', mode: 'includes' },
				{ pattern: 'almuñécar', mode: 'includes' },
				{ pattern: 'rota', mode: 'includes' },
				{ pattern: 'san roque', mode: 'includes' },
				{ pattern: 'chiclana', mode: 'includes' },
				{ pattern: 'almería', mode: 'includes' },
				{ pattern: 'almeria', mode: 'includes' },
				// More Dutch locations
				{ pattern: 'zeeland', mode: 'includes' },
				{ pattern: 'north holland', mode: 'includes' },
				{ pattern: 'zuid-holland', mode: 'includes' },
				{ pattern: 'alkmaar', mode: 'includes' },
				{ pattern: 'zaandam', mode: 'includes' },
				{ pattern: 'hoorn', mode: 'includes' },
				{ pattern: 'baarn', mode: 'includes' },
				{ pattern: 'bunnik', mode: 'includes' },
				{ pattern: 'zeist', mode: 'includes' },
				{ pattern: 'veghel', mode: 'includes' },
				{ pattern: 'woerden', mode: 'includes' },
				{ pattern: 'hillegom', mode: 'includes' },
				{ pattern: 'katwijk', mode: 'includes' },
				{ pattern: 'rijnsburg', mode: 'includes' },
				{ pattern: 'velsen', mode: 'includes' },
				{ pattern: 'bunschoten', mode: 'includes' },
				{ pattern: 'breukelen', mode: 'includes' },
				// Nordic, remaining Western European, and additional German/French/
				// Spanish cities.
				//
				// Matched with word boundaries rather than plain `includes`: several
				// of these are short enough to appear inside unrelated place names —
				// "gent" inside "Argentina", "roma" inside "Romania", "nice" inside
				// "Venice", "bern" inside "Bernburg" — which would misclassify them
				// into this region. Same trap as the US state codes above.
				{
					pattern:
						'\\b(?:copenhagen|k(?:ø|o)benhavn|aarhus|odense|stockholm|gothenburg|g(?:ö|o)teborg|malmo|uppsala|oslo|bergen|trondheim|stavanger|helsinki|espoo|tampere|reykjav(?:í|i)k)\\b',
					mode: 'regex'
				},
				{
					pattern:
						'\\b(?:dublin|cork|galway|brussels?|bruxelles|antwerp(?:en)?|ghent|gent|leuven|vienna|wien|graz|salzburg|z(?:ü|u)rich|geneva|gen(?:è|e)ve|basel|bern|lausanne|lisbon|lisboa|braga|milan|milano|rome|roma|turin|torino|bologna|naples|napoli|florence|firenze|athens|thessaloniki|luxembourg)\\b',
					mode: 'regex'
				},
				// "malmö" ends in a non-ASCII letter, and \\b only sees ASCII word
				// chars, so a trailing boundary would never match. Distinctive enough
				// to match plainly.
				{ pattern: 'malmö', mode: 'includes' },
				// Porto (Portugal) — but not Porto Alegre, which is Brazil.
				{ pattern: '\\bporto\\b(?!\\s+alegre)', mode: 'regex' },
				{
					pattern:
						'\\b(?:leipzig|dresden|hannover|n(?:ü|u)rnberg|nuremberg|karlsruhe|mannheim|bremen|essen|dortmund|toulouse|bordeaux|nantes|lille|nice|grenoble|bilbao|zaragoza|palma)\\b',
					mode: 'regex'
				},
				// European meta
				{ pattern: 'european', mode: 'includes' },
				{ pattern: ', netherlands', mode: 'includes' },
				{ pattern: ', germany', mode: 'includes' },
				{ pattern: ', france', mode: 'includes' },
				{ pattern: ', spain', mode: 'includes' },
				{ pattern: ', italy', mode: 'includes' },
				{ pattern: ', belgium', mode: 'includes' },
				{ pattern: ', ireland', mode: 'includes' },
				{ pattern: ', denmark', mode: 'includes' },
				{ pattern: ', sweden', mode: 'includes' },
				{ pattern: ', norway', mode: 'includes' },
				{ pattern: ', finland', mode: 'includes' },
				{ pattern: ', portugal', mode: 'includes' },
				{ pattern: ', austria', mode: 'includes' },
				{ pattern: ', switzerland', mode: 'includes' },
				{ pattern: ', greece', mode: 'includes' },
				{ pattern: ', luxembourg', mode: 'includes' },
				{ pattern: ', iceland', mode: 'includes' },
				// "emea" exists as an alias, but aliases match the whole string only, so
				// "Home based - EMEA" fell through. Same shape as the israel fix below.
				{ pattern: 'emea', mode: 'includes' },
				// More Dutch and German towns. The list above covers the big cities;
				// real postings are full of small ones.
				{ pattern: 'alphen aan den rijn', mode: 'includes' },
				{ pattern: 'amstelveen', mode: 'includes' },
				{ pattern: 'hengelo', mode: 'includes' },
				{ pattern: 'nieuw-vennep', mode: 'includes' },
				{ pattern: 'reeuwijk', mode: 'includes' },
				{ pattern: 'schiphol', mode: 'includes' },
				{ pattern: 'petten', mode: 'includes' },
				{ pattern: 'heidelberg', mode: 'includes' },
				{ pattern: 'binswangen', mode: 'includes' },
				// Continental postcode-first addresses: "92130 Issy-les-Moulineaux",
				// "10115 Berlin". France, Germany, Spain and Italy all write five digits
				// BEFORE the town. The US writes its five digits last ("Boston, MA
				// 02101"), which is why this is anchored to the start — otherwise it
				// would swallow every US address carrying a ZIP.
				{ pattern: '^[0-9]{5}\\s+[a-zà-ÿ]', mode: 'regex' }
			]
		},
		{
			canonical: 'eastern_europe',
			label: 'Eastern Europe',
			aliases: [
				{ text: 'eastern europe' },
				{ text: 'poland' },
				{ text: 'polska' },
				{ text: 'czech republic' },
				{ text: 'czechia' },
				{ text: 'romania' },
				{ text: 'hungary' },
				{ text: 'bulgaria' },
				{ text: 'croatia' },
				{ text: 'slovakia' },
				{ text: 'slovenia' },
				{ text: 'serbia' },
				{ text: 'ukraine' },
				{ text: 'lithuania' },
				{ text: 'latvia' },
				{ text: 'estonia' },
				// Albania had no coverage at all — not the name, not the code.
				{ text: 'albania' },
				// ISO alpha-3 codes — exact-match only, see the note in asia_pacific.
				{ text: 'pol' },
				{ text: 'rou' },
				{ text: 'cze' },
				{ text: 'hun' },
				{ text: 'alb' }
			],
			patterns: [
				{ pattern: 'warsaw', mode: 'includes' },
				{ pattern: 'prague', mode: 'includes' },
				{ pattern: 'budapest', mode: 'includes' },
				{ pattern: 'bucharest', mode: 'includes' },
				{ pattern: 'krakow', mode: 'includes' },
				{ pattern: 'kraków', mode: 'includes' },
				{ pattern: 'zagreb', mode: 'includes' },
				{ pattern: 'sofia', mode: 'includes' },
				{ pattern: 'bratislava', mode: 'includes' },
				{ pattern: 'ljubljana', mode: 'includes' },
				{ pattern: 'tallinn', mode: 'includes' },
				{ pattern: 'riga', mode: 'includes' },
				{ pattern: 'vilnius', mode: 'includes' },
				// Polish and Romanian cities seen in the wild, including the
				// all-caps site-code style ("POL - PM - GDANSK", "CRAIOVA (REMOTE)").
				{
					pattern:
						'\\b(gdansk|gdańsk|wroclaw|wrocław|poznan|poznań|lodz|łódź|cluj-napoca|craiova|timisoara|timișoara|targu mures|iasi|brasov)\\b',
					mode: 'regex'
				},
				{ pattern: ', poland', mode: 'includes' },
				{ pattern: ', romania', mode: 'includes' },
				{ pattern: ', hungary', mode: 'includes' },
				{ pattern: ', czech', mode: 'includes' },
				{ pattern: ', croatia', mode: 'includes' },
				{ pattern: ', ukraine', mode: 'includes' },
				{ pattern: ', serbia', mode: 'includes' },
				{ pattern: ', bulgaria', mode: 'includes' },
				// Czech regional forms — "BRNO-ŽIDENICE, SOUTH MORAVIA" names no country.
				{ pattern: 'brno', mode: 'includes' },
				{ pattern: 'moravia', mode: 'includes' }
			]
		},
		{
			canonical: 'middle_east',
			label: 'Middle East',
			aliases: [
				{ text: 'middle east' },
				{ text: 'uae' },
				{ text: 'united arab emirates' },
				{ text: 'saudi arabia' },
				{ text: 'israel' },
				{ text: 'qatar' },
				{ text: 'bahrain' },
				{ text: 'kuwait' },
				{ text: 'oman' },
				{ text: 'jordan' },
				{ text: 'lebanon' },
				{ text: 'turkey' },
				{ text: 'türkiye' },
				// ISO alpha-3. "uae" was already here as the colloquial form, but the
				// actual ISO code for the Emirates is ARE, and that is what the feeds
				// send. Exact-match only, so "are" cannot claim the English verb.
				{ text: 'are' },
				{ text: 'isr' }
			],
			patterns: [
				{ pattern: 'dubai', mode: 'includes' },
				{ pattern: 'abu dhabi', mode: 'includes' },
				{ pattern: 'riyadh', mode: 'includes' },
				{ pattern: 'tel aviv', mode: 'includes' },
				// "israel" was an alias, and aliases only ever match the WHOLE string —
				// so "Ramat Gan, Israel" and "Israel, Yokneam" both fell through to
				// null despite naming the country outright.
				{ pattern: 'israel', mode: 'includes' },
				{ pattern: 'ramat gan', mode: 'includes' },
				{ pattern: 'istanbul', mode: 'includes' },
				{ pattern: 'doha', mode: 'includes' },
				{ pattern: 'ankara', mode: 'includes' }
			]
		},
		{
			canonical: 'asia_pacific',
			label: 'Asia Pacific',
			aliases: [
				{ text: 'asia pacific' },
				{ text: 'apac' },
				{ text: 'asia' },
				{ text: 'india' },
				{ text: 'china' },
				{ text: 'japan' },
				{ text: 'south korea' },
				{ text: 'korea' },
				{ text: 'singapore' },
				{ text: 'australia' },
				{ text: 'new zealand' },
				{ text: 'taiwan' },
				{ text: 'malaysia' },
				{ text: 'indonesia' },
				{ text: 'philippines' },
				{ text: 'vietnam' },
				{ text: 'thailand' },
				{ text: 'pakistan' },
				{ text: 'bangladesh' },
				// ISO alpha-3 codes. Aliases are exact-match only, which is what makes
				// these safe to add here and NOT as substring patterns — a bare "AUS"
				// or "IND" field classifies, while "ind" inside a word cannot.
				{ text: 'aus' },
				{ text: 'ind' },
				{ text: 'pak' },
				{ text: 'twn' },
				{ text: 'sgp' },
				{ text: 'phl' },
				{ text: 'idn' },
				{ text: 'hkg' },
				{ text: 'hong kong' }
			],
			patterns: [
				{ pattern: 'taipei', mode: 'includes' },
				{ pattern: 'bengaluru', mode: 'includes' },
				{ pattern: 'bangalore', mode: 'includes' },
				{ pattern: 'mumbai', mode: 'includes' },
				{ pattern: 'hyderabad', mode: 'includes' },
				{ pattern: 'delhi', mode: 'includes' },
				{ pattern: 'gurugram', mode: 'includes' },
				{ pattern: 'pune', mode: 'includes' },
				{ pattern: 'chennai', mode: 'includes' },
				{ pattern: 'tokyo', mode: 'includes' },
				{ pattern: 'sydney', mode: 'includes' },
				{ pattern: 'melbourne', mode: 'includes' },
				{ pattern: 'singapore', mode: 'includes' },
				{ pattern: 'australia', mode: 'includes' },
				{ pattern: ', india', mode: 'includes' },
				{ pattern: ', japan', mode: 'includes' },
				{ pattern: ', australia', mode: 'includes' },
				{ pattern: ', china', mode: 'includes' },
				// More of the region's hubs.
				{ pattern: 'hong kong', mode: 'includes' },
				{ pattern: 'seoul', mode: 'includes' },
				{ pattern: 'bangkok', mode: 'includes' },
				{ pattern: 'ho chi minh', mode: 'includes' },
				{ pattern: 'manila', mode: 'includes' },
				{ pattern: 'jakarta', mode: 'includes' },
				{ pattern: 'jaipur', mode: 'includes' },
				{ pattern: 'coimbatore', mode: 'includes' },
				{ pattern: 'hsinchu', mode: 'includes' },
				// Country names that were aliases only, so anything with a suffix
				// ("Indonesia - Remote", "Taiwan, Hsinchu") fell through to null.
				{ pattern: 'indonesia', mode: 'includes' },
				{ pattern: 'philippines', mode: 'includes' },
				{ pattern: 'vietnam', mode: 'includes' },
				{ pattern: 'south korea', mode: 'includes' },
				{ pattern: 'taiwan', mode: 'includes' },
				{ pattern: 'south east asia', mode: 'includes' },
				// ", china" only catches the country when it TRAILS. Multi-site
				// postings lead with it — "China, Beijing; China, Shanghai" names it
				// twice and still classified as nothing.
				{ pattern: 'china', mode: 'includes' },
				// "IND - Coimbatore (708)" leads with the ISO code. Word-bounded so it
				// cannot fire inside "index" or "individual".
				{ pattern: '^ind\\b', mode: 'regex' }
			]
		},
		{
			canonical: 'latin_america',
			label: 'Latin America',
			aliases: [
				{ text: 'latin america' },
				{ text: 'latam' },
				{ text: 'brazil' },
				{ text: 'brasil' },
				{ text: 'mexico' },
				{ text: 'méxico' },
				{ text: 'argentina' },
				{ text: 'colombia' },
				{ text: 'chile' },
				{ text: 'peru' },
				{ text: 'perú' },
				{ text: 'costa rica' },
				{ text: 'uruguay' },
				// ISO alpha-3, exact-match only.
				{ text: 'per' },
				{ text: 'bra' },
				{ text: 'mex' }
			],
			patterns: [
				{ pattern: 'são paulo', mode: 'includes' },
				{ pattern: 'sao paulo', mode: 'includes' },
				{ pattern: 'buenos aires', mode: 'includes' },
				{ pattern: 'mexico city', mode: 'includes' },
				{ pattern: 'bogotá', mode: 'includes' },
				{ pattern: 'bogota', mode: 'includes' },
				{ pattern: 'santiago', mode: 'includes' },
				{ pattern: 'lima', mode: 'includes' },
				{ pattern: ', brazil', mode: 'includes' },
				{ pattern: ', mexico', mode: 'includes' },
				{ pattern: ', argentina', mode: 'includes' },
				{ pattern: ', colombia', mode: 'includes' },
				{ pattern: 'rio de janeiro', mode: 'includes' },
				// Country names as substrings: "Brazil - Remote", "Brazil; Mexico".
				{ pattern: 'brazil', mode: 'includes' },
				// "Remote (LATAM, excluding Brazil…)" — the region shorthand, which
				// existed as an alias but never as a substring.
				{ pattern: 'latam', mode: 'includes' }
			]
		},
		{
			canonical: 'africa',
			label: 'Africa',
			aliases: [
				{ text: 'africa' },
				{ text: 'south africa' },
				{ text: 'nigeria' },
				{ text: 'kenya' },
				{ text: 'egypt' },
				{ text: 'ghana' },
				{ text: 'ethiopia' },
				{ text: 'tanzania' },
				{ text: 'morocco' },
				{ text: 'uganda' },
				// ISO alpha-3, exact-match only.
				{ text: 'ken' }
			],
			patterns: [
				{ pattern: 'cape town', mode: 'includes' },
				{ pattern: 'johannesburg', mode: 'includes' },
				{ pattern: 'lagos', mode: 'includes' },
				{ pattern: 'nairobi', mode: 'includes' },
				{ pattern: 'cairo', mode: 'includes' },
				{ pattern: 'accra', mode: 'includes' },
				{ pattern: ', south africa', mode: 'includes' },
				{ pattern: ', nigeria', mode: 'includes' },
				{ pattern: ', kenya', mode: 'includes' },
				{ pattern: ', egypt', mode: 'includes' },
				{ pattern: 'uganda', mode: 'includes' }
			]
		}
	]
};

// ============================================================================
// Region classifier
// ============================================================================

const _regionNormalizeMap = buildNormalizeMap(REGIONS);
const _regionPatterns = getPatterns(REGIONS);
/** Compiled once at module load — classifyRegion runs per job row. */
const _regionRegexes = new Map(
	_regionPatterns.filter((p) => p.mode === 'regex').map((p) => [p.pattern, new RegExp(p.pattern)])
);

/**
 * Classify a job's office_location string into a canonical region.
 * Returns the canonical region key or null if unclassifiable.
 *
 * Strategy:
 * 1. Strip work arrangement suffixes like "(Remote)", "(Hybrid)", "(On-site)"
 * 2. Try exact match against aliases
 * 3. Try pattern matching (substring/prefix)
 *
 * Region priority: more specific regions (US, UK) are checked before
 * broader ones (Western Europe) via pattern definition order.
 */
export function classifyRegion(location: string | null | undefined): string | null {
	if (!location) return null;

	// Strip work arrangement suffixes
	const cleaned = location
		.replace(/\s*\((?:remote|hybrid|on-?site)\)\s*/gi, '')
		.trim()
		.toLowerCase();

	if (!cleaned) return null;

	// Exact match
	const exact = _regionNormalizeMap.get(cleaned);
	if (exact) return exact;

	// Pattern match — order matters: US state patterns are checked first,
	// then UK, then Western Europe, etc.
	for (const p of _regionPatterns) {
		if (p.mode === 'includes' && cleaned.includes(p.pattern)) {
			return p.canonical;
		}
		if (p.mode === 'startsWith' && cleaned.startsWith(p.pattern)) {
			return p.canonical;
		}
		if (p.mode === 'regex' && _regionRegexes.get(p.pattern)!.test(cleaned)) {
			return p.canonical;
		}
	}

	return null;
}

// ============================================================================
// Derived helpers — used by consumers
// ============================================================================

/** Strip all separators (hyphens, underscores, spaces) and lowercase */
function strip(s: string): string {
	return s.toLowerCase().replace(/[-_\s]/g, '');
}

/**
 * Build a display label map: lowercased alias → display string.
 * Used by format.ts for UI rendering.
 */
export function buildDisplayMap(category: TaxonomyCategory): Map<string, string> {
	const map = new Map<string, string>();
	for (const val of category.values) {
		for (const alias of val.aliases) {
			map.set(alias.text, alias.displayLabel ?? val.label);
		}
	}
	return map;
}

/**
 * Build a normalization map: lowercased alias → canonical value.
 * Used by matcher.ts for in-memory matching.
 */
export function buildNormalizeMap(category: TaxonomyCategory): Map<string, string> {
	const map = new Map<string, string>();
	for (const val of category.values) {
		for (const alias of val.aliases) {
			map.set(alias.text, val.canonical);
		}
	}
	return map;
}

/**
 * Get all patterns for a category, with their canonical values.
 * Used by matcher.ts for fuzzy matching after exact lookup fails.
 */
export function getPatterns(category: TaxonomyCategory): (Pattern & { canonical: string })[] {
	const result: (Pattern & { canonical: string })[] = [];
	for (const val of category.values) {
		for (const p of val.patterns ?? []) {
			result.push({ ...p, canonical: val.canonical });
		}
	}
	return result;
}

/**
 * Build family expansion map: canonical → set of stripped alias forms.
 * Used by eligibility.ts for SQL filter expansion.
 *
 * Strips hyphens, underscores, and spaces so "one-time project" becomes
 * "onetimeproject", matching the normalizeValue() in eligibility.ts.
 */
export function buildFamilyMap(category: TaxonomyCategory): Map<string, string[]> {
	const map = new Map<string, string[]>();
	for (const val of category.values) {
		const stripped = new Set<string>();
		for (const alias of val.aliases) {
			stripped.add(strip(alias.text));
		}
		// Also add pattern strings as stripped entries for contains-matching
		for (const p of val.patterns ?? []) {
			stripped.add(strip(p.pattern));
		}
		map.set(strip(val.canonical), Array.from(stripped));
	}
	return map;
}

/**
 * Get canonical labels for config/preference UI options.
 * Returns labels in definition order.
 */
export function getOptionLabels(category: TaxonomyCategory): string[] {
	return category.values.map((v) => v.label);
}

/**
 * Display-label pattern matching: check patterns for a value not found via exact lookup.
 * Returns the display label if a pattern matches, or null.
 */
export function matchPatternDisplay(category: TaxonomyCategory, input: string): string | null {
	const lower = input.toLowerCase();
	for (const val of category.values) {
		for (const p of val.patterns ?? []) {
			if (p.mode === 'includes' && lower.includes(p.pattern)) return val.label;
			if (p.mode === 'startsWith' && lower.startsWith(p.pattern)) {
				return val.label;
			}
		}
	}
	return null;
}
