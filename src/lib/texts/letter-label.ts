/**
 * What a letter is called, everywhere it is listed.
 *
 * Client-safe on purpose. The rule has two halves — the labels the two types go
 * by, and the title taking over from the type where a letter has one — and both
 * halves are needed by the pages that list letters and by the server that hands
 * a label to an agent. It lived server-side while a letter's name was its type
 * and four Svelte files each kept their own copy of the map; two of them spelled
 * it "Cover Letter" and two "Cover letter". A fallback rule copied that many
 * times is a rule with four chances to drift, which is the thing this file
 * exists to prevent.
 */

/** The two types a letter can be, and what a list calls each. */
export const LETTER_TYPE_LABELS: Record<string, string> = {
	cover_letter: 'Cover letter',
	cheat_sheet: 'Interview cheat sheet'
};

/**
 * A letter's own name: its title where it has one, its type where it does not.
 *
 * The title wins because that is the whole reason it exists. A letter is named
 * by its type until an application has two of the same type, and then the type
 * is the one thing that cannot tell them apart. A blank title counts as no
 * title, so a field somebody cleared falls back rather than naming a row "".
 *
 * Note that `letter_type` can itself be "cheat_sheet", which is NOT the
 * `cheat_sheets` table of interview-prep sheets on the profile: two features
 * named the same thing, one written on an application and one not.
 */
export function letterLabel(letterType: string, title?: string | null): string {
	return title?.trim() || LETTER_TYPE_LABELS[letterType] || letterType;
}
