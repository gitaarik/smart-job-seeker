/**
 * Preparing a posting's text for the extraction prompt.
 *
 * Two kinds of input reach `parseJobDescription`. A page the scraper captured
 * is HTML: its structure lives in tags, and its newlines are indentation, so
 * `stripHtmlForLlm` deletes every one of them. Text a person pasted into
 * /applications/new — a recruiter's email, a copied vacancy, a freelance
 * assignment — is not HTML, and its structure lives in nothing BUT newlines:
 * the title is the first line, the company the one under it, "Standplaats:
 * Utrecht" a line of its own.
 *
 * Both used to go through the stripper, which fused a paste into a single line
 * with its words run together across the old breaks. "Senior FS for supplier
 * intelligence productsFull-stack Web Developer | Senior" was stored as a job
 * title that way, and a Dutch assignment reached the model as
 * "OpdrachtomschrijvingIn algemene zin…" — the heading fused to the body, and
 * the layout that said which line was the title gone with it. The model then
 * had to guess at the header fields, and mostly, correctly, declined.
 *
 * So the two inputs are told apart here and prepared differently: HTML is
 * stripped, plain text is tidied and keeps its lines.
 */

import { stripHtmlForLlm } from '$lib/server/html/strip';

const TAG_LIKE = /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/gi;
const DOCUMENT_TAG = /<(?:!doctype|html|body)\b/i;

/** Same ceiling the HTML stripper applies, for the same reason. */
const MAX_CHARS = 300_000;

/**
 * Is this a captured page rather than text somebody typed or pasted?
 *
 * A document tag settles it. Short of one, three tag-like tokens do: plain
 * text can carry a stray "<b>" or an "a <b> c" someone typed, and one or two of
 * those are not a page — while a real page, even a fragment of one, has dozens.
 */
export function looksLikeHtml(text: string): boolean {
	if (DOCUMENT_TAG.test(text)) return true;
	return (text.match(TAG_LIKE) ?? []).length >= 3;
}

/**
 * Tidy pasted text without losing its lines.
 *
 * Line endings are unified, zero-width characters (which pastes from web pages
 * and Word carry invisibly) dropped, runs of spaces and tabs collapsed, every
 * line trimmed, and runs of blank lines reduced to one — so a heading followed
 * by five empty lines and a bullet reads as a heading and a bullet. Nothing
 * that separates one line from the next is touched.
 */
export function normalizePlainTextPosting(text: string): string {
	let cleaned = text
		.replace(/\r\n?/g, '\n')
		.replace(/\u200b|\u200c|\u200d|\ufeff/g, '')
		.replace(/[^\S\n]+/g, ' ')
		.replace(/ ?\n ?/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	if (cleaned.length > MAX_CHARS) {
		cleaned = cleaned.slice(0, MAX_CHARS) + '\n[Content truncated]';
	}
	return cleaned;
}

/** The text the extraction prompt gets, for either kind of input. */
export function prepareJobTextForLlm(text: string): string {
	return looksLikeHtml(text) ? stripHtmlForLlm(text) : normalizePlainTextPosting(text);
}
