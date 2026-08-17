/**
 * Which part of the profile a message is about, decided from the message.
 *
 * ## What this is for
 *
 * Page bias covers the common case — people are on the page holding the thing
 * they want to change — and the manifest covers the rest honestly: asked to fix
 * a language from a job page, the assistant says "that's on your Languages
 * page" instead of denying languages exist. What neither covers is the user who
 * asks from somewhere else and is perfectly clear about it. They named the
 * section, the assistant knows the section exists, and it still sends them away
 * to do it by hand.
 *
 * This closes that gap without a tool-call round trip, which the single
 * structured-output turn behind `{reply, proposals}` cannot afford.
 *
 * ## Deterministic, and why not embeddings
 *
 * `content_embeddings` exists and semantic ranking was the obvious alternative,
 * but this is not a ranking problem. A ranker returns an ordered list of
 * everything and needs a threshold, and the threshold is the part that would
 * have to be picked blind and re-picked whenever the corpus changed. A keyword
 * match either fires or it does not: it is readable in a test, it costs no
 * network hop on a turn that already makes an expensive one, and when it is
 * wrong it is wrong in a way you can point at.
 *
 * It also survives the thing embeddings would be worst at. The signal here is
 * mostly proper nouns — "Spanish", an employer's name, a certificate's issuer —
 * which are exactly the tokens a semantic model has least to say about.
 *
 * ## The two tiers have different rules, on purpose
 *
 * **The message names a section** ("update my education"). Matched against the
 * section's declared vocabulary. Then, and only then, the rows of that section
 * are matched by their significant words, to narrow the offer from "any of these
 * twelve" to "this one, and here is what it currently says". Loose token
 * matching is safe here because the section is already established: the worst a
 * wrong token does is fail to narrow, and the model gets the list it would
 * otherwise have got.
 *
 * **The message names a row and no section** ("make my Spanish fluent"). This
 * one has nothing establishing it, so it is strict: the row's *whole* label has
 * to appear in the message. And it is tried only for the sections edited inline
 * on their list — language, reference, certificate, highlight — because those
 * are the ones whose labels are short enough for a whole-label match to ever
 * fire. "Senior Engineer at Acme Corp" will not appear verbatim in a sentence,
 * so looking for it would cost a read of the applicant's entire work history on
 * every turn to find nothing.
 *
 * Skills are edited inline too and are deliberately NOT in that tier. Their
 * labels are short enough — that is the problem. "React" is in half the job
 * descriptions this assistant reads, so a whole-label match on a skill fires on
 * turns that were never about the profile. The section says so itself, in
 * `rowNamesAreAmbiguous`, because it is a fact about the section's vocabulary
 * rather than a rule this file should be keeping a list for.
 *
 * ## What a false positive costs
 *
 * Prompt budget, and an offer. A section loaded that the user did not mean adds
 * its contract to the turn and lets the model propose a change there — but the
 * proposal is still a card, and the card is still applied by hand. Nothing here
 * writes. That asymmetry is what makes a keyword matcher acceptable at all, and
 * it is why the aliases in the declaration are conservative while the row
 * narrowing is not.
 */

import {
	PROFILE_RESOURCE_NAMES,
	PROFILE_RESOURCES,
	type ProfileResourceName
} from '$lib/server/profile/resources';
import { readOwnedRows } from '$lib/server/profile/write';

/** A section the message pointed at, and the row it pointed at within it. */
export interface SectionMatch {
	resource: ProfileResourceName;
	/**
	 * The row the message named, when exactly one did — so the capability gets a
	 * single target and its current values, the same shape a detail page
	 * produces. Null keeps the whole list and lets the model name one.
	 */
	row: { id: number; label: string } | null;
	/** Which tier found it. Ranks the results, and makes a test say what it tested. */
	via: 'section' | 'row';
	/** Where the earliest hit was in the message — the tie-break between sections. */
	at: number;
}

/**
 * Lowercased, punctuation collapsed to single spaces, padded at both ends.
 *
 * The padding is what makes a whole-word test a plain substring test: with
 * ` the message ` on both sides, ` degree ` cannot match inside "degrees" and
 * does not need a regex to say so. Punctuation goes because a section named at
 * the end of a sentence, in quotes, or hyphenated is the same section.
 */
function normalize(text: string): string {
	return ` ${text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim()} `;
}

/**
 * A term and its naive plural. People write "certificate" and "certificates"
 * interchangeably, and listing both in every declaration would be a second place
 * to forget one.
 */
function variants(term: string): string[] {
	const t = normalize(term).trim();
	if (!t) return [];
	return t.endsWith('s') ? [t] : [t, `${t}s`];
}

/**
 * What the nav calls it, what the code calls it, and what people call it —
 * built once, because it is the same for every turn and every profile.
 */
const SECTION_TERMS: Record<ProfileResourceName, string[]> = Object.fromEntries(
	PROFILE_RESOURCE_NAMES.map((name) => {
		// `title`, not `page.name`: two sections share the skills page, and a term
		// list built from the page would give both of them "skills" and neither of
		// them a word that tells them apart.
		const { title, label, aliases = [] } = PROFILE_RESOURCES[name];
		return [name, [...new Set([title, label, ...aliases].flatMap(variants))]];
	})
) as Record<ProfileResourceName, string[]>;

/**
 * Every section term, flattened.
 *
 * A word that names a section is a section signal, not a row signal — which
 * matters because empty rows are labelled "Untitled role", "Untitled language"
 * and so on. Without this, "add a role" would match the *rows* of every
 * unnamed work experience and narrow to one of them at random.
 */
const ALL_SECTION_WORDS = new Set(
	Object.values(SECTION_TERMS).flatMap((terms) => terms.flatMap((term) => term.split(' ')))
);

/**
 * Short words that carry no identity. Deliberately small: the length floor
 * below does most of the work, and a long stoplist is a place for a real
 * employer name to get quietly dropped.
 */
const STOPWORDS = new Set([
	'the',
	'and',
	'for',
	'was',
	'with',
	'from',
	'that',
	'this',
	'they',
	'their',
	'there',
	'here',
	'have',
	'has',
	'had',
	'not',
	'but',
	'you',
	'your',
	'our',
	'its',
	'untitled',
	'ltd',
	'inc',
	'bv',
	'gmbh'
]);

/** Three, so "AWS", "IBM" and "SQL" survive — the abbreviations that ARE the name. */
const MIN_TOKEN_LENGTH = 3;

/** The words of a row label that could identify it in a sentence. */
function labelTokens(label: string): string[] {
	return normalize(label)
		.trim()
		.split(' ')
		.filter(
			(token) =>
				token.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(token) && !ALL_SECTION_WORDS.has(token)
		);
}

/**
 * Where the earliest of these terms appears, and how much of the message it
 * claimed there.
 *
 * The length is the tie-break between two sections that hit at the same place,
 * which is not a hypothetical: "skill category" and "skill" both start at the
 * same word of "add a skill category for cloud", and without this the winner is
 * whichever section happens to be declared first. Longer means more of the
 * user's words accounted for, which is the only reading of "more specific" that
 * does not require a hand-maintained priority list.
 */
function earliestMatch(haystack: string, terms: string[]): { at: number; length: number } {
	let best = { at: -1, length: 0 };
	for (const term of terms) {
		const at = haystack.indexOf(` ${term} `);
		if (at === -1) continue;
		if (best.at === -1 || at < best.at || (at === best.at && term.length > best.length)) {
			best = { at, length: term.length };
		}
	}
	return best;
}

/** Where the earliest of these terms appears in the message, or -1 for none. */
function earliestHit(haystack: string, terms: string[]): number {
	return earliestMatch(haystack, terms).at;
}

/** The rows whose significant words appear in the message. */
function rowsNamedIn(haystack: string, rows: RowLabel[]) {
	return rows.filter((row) => earliestHit(haystack, labelTokens(row.match ?? row.label)) !== -1);
}

/**
 * The rows a message names, out of rows that are already reachable.
 *
 * The same narrowing tier one does, exported for the other half of the problem:
 * a section the page DOES grant, whose list is too long to print. There the
 * question is not which section the user means — that is settled — but which of
 * a hundred rows, and the answer is the same one, from the same tokens.
 *
 * Returns them in the order given, and an empty array when the message names
 * none. It is the caller's business what to do with that: `resolveCapabilities`
 * falls back to the head of the list rather than to nothing, because a message
 * that names no row is usually not asking for a row.
 */
export function rowsNamedInMessage<T extends { label: string; match?: string }>(
	message: string,
	rows: T[]
): T[] {
	const haystack = normalize(message);
	if (haystack.trim() === '') return [];
	return rows.filter((row) => earliestHit(haystack, labelTokens(row.match ?? row.label)) !== -1);
}

/** A row as the matcher sees it: what it is called, and what identifies it. */
interface RowLabel {
	id: number;
	label: string;
	/** The row's own name where the label carries more — see CapabilityTarget.match. */
	match?: string;
}

type RowLabels = RowLabel[];

/**
 * One read per section per turn, however many messages are searched.
 *
 * Without it, a message window of four that matches nothing until the oldest
 * turn re-reads the same tables four times. The cache is per call rather than
 * per process on purpose — the rows are the profile's live state, and a
 * proposal applied earlier in the same conversation has to be visible to the
 * next turn.
 */
function rowReader(profileId: number): (name: ProfileResourceName) => Promise<RowLabels> {
	const seen = new Map<ProfileResourceName, Promise<RowLabels>>();

	return (name) => {
		const cached = seen.get(name);
		if (cached) return cached;

		const resource = PROFILE_RESOURCES[name];
		const reading = readOwnedRows(name, { profileId }).then((rows) =>
			rows.map((row) => ({
				id: row.id,
				label: resource.rowLabel(row),
				// Narrowed on the row's own name where its label says more than the
				// row does — see CapabilityTarget.match.
				...(resource.shortLabel ? { match: resource.shortLabel(row) } : {})
			}))
		);
		seen.set(name, reading);
		return reading;
	};
}

/** Tier one: the message names the section outright. */
async function matchBySectionName(
	haystack: string,
	rows: (name: ProfileResourceName) => Promise<RowLabels>,
	candidates: ProfileResourceName[]
): Promise<SectionMatch[]> {
	const named = candidates
		.map((resource) => ({ resource, ...earliestMatch(haystack, SECTION_TERMS[resource]) }))
		.filter(({ at }) => at !== -1)
		// Earliest first, and the more specific name first where two start at the
		// same word. Order decides which section the budget admits when both match
		// and only one fits, so the specific one has to come first.
		.sort((a, b) => a.at - b.at || b.length - a.length);

	return Promise.all(
		named.map(async ({ resource, at }): Promise<SectionMatch> => {
			// Narrow to one row where the message named one. Several named rows is
			// not a failure — it is a genuine choice, and the model is better placed
			// to make it from the list than this is from a token count.
			const hits = rowsNamedIn(haystack, await rows(resource));
			return { resource, row: hits.length === 1 ? hits[0] : null, via: 'section', at };
		})
	);
}

/**
 * Tier two: the message names a row and never says which section.
 *
 * Only for the sections with no detail page, per the note at the top of this
 * file — those are the short-label ones, and they are also the cheapest to read.
 */
async function matchByRowLabel(
	haystack: string,
	rows: (name: ProfileResourceName) => Promise<RowLabels>,
	candidates: ProfileResourceName[]
): Promise<SectionMatch[]> {
	// Not the child collections either, and not because their names are ambiguous
	// — because they do not have one. A child's label carries its parent's, to
	// stay unique across the profile: a project reads "the migration — Senior
	// Engineer at Chipta", which is the same thing the note at the top of this
	// file says a work experience's label is and will not appear verbatim in a
	// sentence. Looking for it would read every project, achievement and
	// technology on the profile, every turn, to find nothing.
	const inline = candidates.filter((name) => {
		const resource = PROFILE_RESOURCES[name];
		return (
			!resource.detailPath && !resource.rowNamesAreAmbiguous && resource.owner.via !== 'parent'
		);
	});

	const found = await Promise.all(
		inline.map(async (resource): Promise<SectionMatch | null> => {
			const hits = (await rows(resource))
				.map((row) => ({ row, at: earliestHit(haystack, [normalize(row.label).trim()]) }))
				.filter(({ at }) => at !== -1);
			if (hits.length === 0) return null;

			const at = Math.min(...hits.map((hit) => hit.at));
			return { resource, row: hits.length === 1 ? hits[0].row : null, via: 'row', at };
		})
	);

	return found.filter((match): match is SectionMatch => match !== null);
}

/**
 * The sections a conversation is currently about, most specific first.
 *
 * `messages` is oldest → newest, and only the newest one that matches anything
 * is used. That is what makes a follow-up work: "add Spanish to my languages"
 * names the section, "actually make it conversational" names nothing, and the
 * second turn inherits the first rather than losing the capability halfway
 * through the exchange. As soon as a turn names a different section, that one
 * wins outright — stickiness that accumulated would end up offering every
 * section the conversation had ever wandered past.
 *
 * `exclude` is what the page already grants. A section reachable from here is
 * not a section that needs finding, and resolving it twice would put two copies
 * of its contract in the prompt.
 */
export async function matchProfileSections(opts: {
	messages: string[];
	profileId: number;
	exclude?: ProfileResourceName[];
}): Promise<SectionMatch[]> {
	const excluded = new Set(opts.exclude ?? []);
	const candidates = PROFILE_RESOURCE_NAMES.filter((name) => !excluded.has(name));
	if (candidates.length === 0) return [];

	const rows = rowReader(opts.profileId);

	for (const message of [...opts.messages].reverse()) {
		const haystack = normalize(message);
		if (haystack.trim() === '') continue;

		const byName = await matchBySectionName(haystack, rows, candidates);
		if (byName.length > 0) return byName;

		const byRow = await matchByRowLabel(haystack, rows, candidates);
		if (byRow.length > 0) return byRow.sort((a, b) => a.at - b.at);
	}

	return [];
}
