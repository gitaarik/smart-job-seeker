/**
 * Caller-side clean-up of the four header fields the extraction model returns:
 * title, company, job_poster, location.
 *
 * The prompt states the contract; this enforces the part of it a model breaks
 * in ways that are recognisable without the posting in hand. A label echoed
 * along with its value ("Functietitel: Semantic AI Engineer"), a section
 * heading returned as the title ("Opdrachtomschrijving"), two lines fused into
 * one, the hiring company repeated as its own recruiter, "our client" standing
 * in for a name the posting never gave — each has turned up in stored jobs, and
 * each is cheaper to fix here, once, than to re-prompt around and hope.
 *
 * Everything here is a null-or-trim decision. Nothing is invented, and a value
 * this cannot vouch for becomes null rather than something plausible: the
 * form's review step shows the user an empty box, which they can fill, where a
 * wrong value looks finished and gets saved.
 */

export interface ExtractedHeader {
	title: string | null;
	company: string | null;
	job_poster: string | null;
	location: string | null;
}

/** Longest value each field can plausibly hold; beyond it, it's a sentence. */
const MAX_LENGTH: Record<keyof ExtractedHeader, number> = {
	title: 120,
	company: 100,
	job_poster: 120,
	location: 120
};

/** A label the model echoed in front of the value it was asked for. */
const LABEL_PREFIX =
	/^(?:job\s*title|title|position|role|function|functie(?:titel|naam)?|vacature|company|employer|organi[sz]ation|organisatie|opdrachtgever|eindklant|client|klant|location|locatie|standplaats|werklocatie|work\s*city|plaats|office|kantoor|recruiter|contact(?:persoon)?|intermediair|bemiddelaar|posted\s+by)\s*[:：]\s*/i;

/** "via Citrus-IT", "namens Avance" — the relation, not the name. */
const POSTER_PREFIX = /^(?:via|namens|through|by)\s+/i;

/** Separators and bullets left dangling at either end after a split. */
const LEADING_JUNK = /^[\s\-–—|:•·,;.]+/;
const TRAILING_JUNK = /[\s\-–—|:•·,;]+$/;

/** Compare names the way a reader would: letters and digits only, one case. */
function key(value: string): string {
	return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * Headings a paste opens with, which a "first line is the title" reading turns
 * into titles. Keyed through `key()` so "Opdracht omschrijving" and
 * "Opdrachtomschrijving" are the same heading.
 */
const SECTION_HEADINGS = new Set(
	[
		'job description',
		'description',
		'job',
		'vacancy',
		'position',
		'position overview',
		'overview',
		'role',
		'the role',
		'about the role',
		'about the job',
		'about the position',
		'job details',
		'job summary',
		'summary',
		'requirements',
		'responsibilities',
		'what you will do',
		"what you'll do",
		'vacature',
		'vacaturetekst',
		'functie',
		'de functie',
		'over de functie',
		'functieomschrijving',
		'functiebeschrijving',
		'functieprofiel',
		'de rol',
		'over de rol',
		'opdracht',
		'de opdracht',
		'over de opdracht',
		'opdrachtomschrijving',
		'opdrachtbeschrijving',
		'omschrijving',
		'werkzaamheden',
		'taken',
		'eisen',
		'profiel',
		'jouw profiel',
		'wat ga je doen'
	].map(key)
);

/** What a model writes for a company the posting describes but never names. */
const UNNAMED_COMPANY = new Set(
	[
		'our client',
		'the client',
		'client',
		'our customer',
		'confidential',
		'undisclosed',
		'unknown',
		'not specified',
		'not mentioned',
		'n/a',
		'none',
		'null',
		'onze opdrachtgever',
		'de opdrachtgever',
		'opdrachtgever',
		'onze klant',
		'de klant',
		'vertrouwelijk',
		'onbekend',
		'niet vermeld',
		'niet genoemd'
	].map(key)
);

/** Whitespace-collapse, de-label and de-junk one value; null when nothing is left. */
function clean(value: unknown, field: keyof ExtractedHeader): string | null {
	if (typeof value !== 'string') return null;
	let text = value;
	// A title that came back as two lines is two candidates; the first is the
	// headline. The other fields read fine collapsed onto one line.
	if (field === 'title') text = text.split(/\r?\n/).find((line) => line.trim()) ?? '';
	text = text.replace(/\s+/g, ' ').trim();
	text = text.replace(LABEL_PREFIX, '');
	if (field === 'job_poster') text = text.replace(POSTER_PREFIX, '');
	text = text.replace(LEADING_JUNK, '').replace(TRAILING_JUNK, '');
	if (!text || !key(text)) return null;
	if (text.length > MAX_LENGTH[field]) return null;
	return text;
}

/**
 * Drop a name a headline tacked onto the title — "Senior Python Developer at
 * TSC", "Semantic AI Engineer – Alliander", "Data Engineer (Lisbon)" — but only
 * when it is the very name the model extracted for that field, so nothing that
 * is genuinely part of the role ("Engineer, Platform") is touched.
 */
function stripTrailingName(title: string, name: string | null): string {
	if (!name) return title;
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(
		`^(.+?)(?:\\s+(?:at|bij|@|in)\\s+|\\s*[-–—|/,:]\\s*|\\s*\\(\\s*)${escaped}\\s*\\)?\\s*$`,
		'i'
	);
	const match = title.match(pattern);
	if (!match) return title;
	const rest = match[1].replace(TRAILING_JUNK, '').trim();
	return rest.length >= 3 ? rest : title;
}

/**
 * Clean the model's title / company / job_poster / location, in that order of
 * trust: the company and location are settled first, then used to trim the
 * title, then the recruiter is checked against the company.
 */
export function sanitizeExtractedHeader(raw: {
	title?: unknown;
	company?: unknown;
	job_poster?: unknown;
	location?: unknown;
}): ExtractedHeader {
	let company = clean(raw.company, 'company');
	if (company && UNNAMED_COMPANY.has(key(company))) company = null;

	const location = clean(raw.location, 'location');

	let title = clean(raw.title, 'title');
	if (title) {
		// "Lead Engineer | Matrixian | Amsterdam" sheds one name per pass; two
		// passes cover either order.
		for (let pass = 0; pass < 2; pass++) {
			title = stripTrailingName(stripTrailingName(title, location), company);
		}
		if (SECTION_HEADINGS.has(key(title))) title = null;
		else if (company && key(title) === key(company)) title = null;
	}

	let jobPoster = clean(raw.job_poster, 'job_poster');
	if (jobPoster && company && key(jobPoster) === key(company)) jobPoster = null;

	return { title, company, job_poster: jobPoster, location };
}

/**
 * One header field as the second pass returns it: a value and the line it was
 * read from. See header-recovery.ts.
 */
export interface GroundedField {
	value?: string | null;
	quote?: string | null;
}

export interface GroundedHeaderResponse {
	title?: GroundedField | null;
	company?: GroundedField | null;
	job_poster?: GroundedField | null;
	location?: GroundedField | null;
	/** A description of the work, offered only when the posting names no role. */
	suggested_title?: string | null;
}

/**
 * Below this a posting is a line or two, and a title "built from what the
 * person will do" would be built from nothing — the model would produce
 * filler. The one-liner case ("We are hiring a data engineer in Lisbon") is an
 * extraction, not a suggestion, and is handled by `title`.
 */
export const MIN_POSTING_CHARS_FOR_SUGGESTION = 300;

/**
 * The model's suggested title, cleaned like an extracted one and gated on the
 * posting being substantial enough to describe. Unlike the four header fields
 * this is a synthesis, so there is no quote to ground it against; what keeps
 * it honest is that it is only ever shown as a suggestion.
 */
export function suggestedTitle(
	response: GroundedHeaderResponse | null | undefined,
	posting: string
): string | null {
	if (posting.trim().length < MIN_POSTING_CHARS_FOR_SUGGESTION) return null;
	return sanitizeExtractedHeader({ title: response?.suggested_title }).title;
}

/** Letters and digits with single spaces, one case: how a quote is matched. */
function loose(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

/**
 * Keep a value only when the posting backs it: the quote must appear in the
 * posting, and every word of the value must appear in the quote.
 *
 * The second half is per word rather than whole-string because a recruiter is
 * composed from two lines ("Sanne de Vries" and "Recruiter, Citrus-IT" →
 * "Sanne de Vries (Citrus-IT)") and a title is Title-Cased from running text.
 * A word the quote does not contain is a word the posting did not say.
 */
export function groundedValue(
	field: GroundedField | null | undefined,
	posting: string
): string | null {
	const value = field?.value?.trim();
	const quote = field?.quote?.trim();
	if (!value || !quote) return null;
	const looseQuote = loose(quote);
	if (!looseQuote || !loose(posting).includes(looseQuote)) return null;
	const words = loose(value).split(' ').filter(Boolean);
	if (words.length === 0) return null;
	return words.every((word) => looseQuote.includes(word)) ? value : null;
}

/** Every field of a header-pass answer, grounded against the posting it came from. */
export function groundHeader(
	response: GroundedHeaderResponse | null | undefined,
	posting: string
): ExtractedHeader {
	return {
		title: groundedValue(response?.title, posting),
		company: groundedValue(response?.company, posting),
		job_poster: groundedValue(response?.job_poster, posting),
		location: groundedValue(response?.location, posting)
	};
}
