/**
 * Whether two versions of a text say the same thing.
 *
 * One rule in one place because four surfaces ask it and they have to agree:
 * the timeline's "Current …" badge, `latest_is_current` on every text a tool
 * lists, the version verb's refusal to propose what is already there, and the
 * commit verb's answer to which version the row is showing. A disagreement
 * between any two of them is visible to the applicant as a version that is
 * waiting and a text that already says it.
 *
 * ## Why line endings and not more
 *
 * Trimming was the whole rule and it missed the difference nobody can see. A
 * cheat sheet stored with CRLF and a version of it written with LF are 6,159
 * and 6,092 characters of identical prose, and every one of those surfaces read
 * that as a rewrite: the badge sat on no version, `latest_is_current` said a
 * proposal was waiting, and the guard against re-proposing an unchanged text
 * let it through. Found on a real sheet, where the "waiting version" was the
 * sheet's own words with 67 carriage returns removed.
 *
 * It stops there on purpose. Whitespace inside a line, case and punctuation are
 * differences a person can see and may have made deliberately; folding them
 * would mean a text that quietly disagrees with the version it claims to be.
 */

/** `\r\n` and a bare `\r` both become `\n`. Nothing else is touched. */
export function normalizeLineEndings(text: string): string {
	return text.replace(/\r\n?/g, '\n');
}

export function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
	return normalizeLineEndings(a ?? '').trim() === normalizeLineEndings(b ?? '').trim();
}
