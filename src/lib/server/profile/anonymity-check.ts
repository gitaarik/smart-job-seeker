/**
 * Reading an anonymous document's PDF for anything that still names the
 * applicant.
 *
 * anonymity.ts takes out what can be decided without reading prose: the
 * fields, the applicant's own business, links under their handles. What it
 * cannot take out is a sentence. A testimonial that begins "Rik moderniseerde
 * de interfaces", a summary that mentions a home town, a project called after
 * its author: each sits in an ordinary field of an ordinary row, and on the
 * first anonymous CV made here those outnumbered the fields.
 *
 * So this reads the file the applicant will actually send, not the profile it
 * came from: the text, the document's own properties (a PDF's title is copied
 * from the page's) and the links. Whatever path a name took onto the page
 * (a translation, a wording a version picked, a template), it is in the file.
 */

import { eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { profiles } from '$lib/server/db/schema';
import type { LeakHit, LeakKind } from '$lib/resume-anonymity';
import { foldText, identityOf } from '$lib/server/profile/anonymity';
import { getLatestExportWithFile } from '$lib/server/profile/export-files';

export interface IdentityTerm {
	kind: LeakKind;
	/** What is searched for, as the applicant wrote it. */
	term: string;
}

/** Name particles that are words in their own right, and too short to stand for anyone. */
const PARTICLES = new Set([
	'van',
	'de',
	'der',
	'den',
	'het',
	'ter',
	'ten',
	'te',
	'op',
	'in',
	"'t",
	'von',
	'zu',
	'la',
	'le',
	'du',
	'da',
	'di',
	'del',
	'dos',
	'das',
	'el',
	'al',
	'bin',
	'ibn'
]);

/** Local parts that name a mailbox rather than a person. */
const GENERIC_MAILBOXES = new Set(['info', 'contact', 'hello', 'mail', 'admin', 'office', 'jobs']);

const text = (value: unknown): string | null =>
	typeof value === 'string' && value.trim() ? value.trim() : null;

const digits = (value: string | null): string => (value ?? '').replace(/\D/g, '');

/**
 * Everything on the profile row that would identify the applicant if it
 * turned up in the document. Read off the row itself, so it needs the columns
 * no page carries (the address, the registrations).
 */
export function identityTerms(profile: object): IdentityTerm[] {
	const row = profile as Record<string, unknown>;
	const terms: IdentityTerm[] = [];
	const add = (kind: LeakKind, term: string | null | undefined) => {
		if (term && term.trim().length >= 3) terms.push({ kind, term: term.trim() });
	};

	const name = text(row.name);
	add('name', name);
	for (const part of (name ?? '').split(/\s+/)) {
		if (!PARTICLES.has(part.toLowerCase())) add('name', part);
	}
	add('business', text(row.company_name));

	const email = text(row.email_address);
	add('email', email);
	const mailbox = email?.split('@')[0] ?? '';
	if (mailbox.length >= 4 && !GENERIC_MAILBOXES.has(mailbox.toLowerCase())) add('handle', mailbox);

	for (const phone of [text(row.phone_number), text(row.whatsapp_number)]) {
		// The last nine digits: what every way of writing a Dutch mobile shares
		// (+31 6…, 06-…, 0031 6…), and enough to be nobody else's.
		const tail = digits(phone).slice(-9);
		if (tail.length === 9) add('phone', tail);
	}

	for (const mark of identityOf(profile).linkMarks) add('handle', mark);
	const host = (() => {
		try {
			return new URL(text(row.personal_website) ?? '').hostname.replace(/^www\./, '');
		} catch {
			return '';
		}
	})();
	const label = host.split('.')[0];
	if (label.length >= 5) add('handle', label);

	add('address', text(row.street_address));
	add('address', text(row.postal_code));
	add('registration', digits(text(row.kvk_number)) || null);
	// A VAT number has letters in it ("NL…B01"), so it is looked for as written.
	add('registration', text(row.vat_id)?.replace(/\s+/g, ''));

	// Where they live: the town in "Haarlem, The Netherlands". Worth a look
	// rather than certainly wrong, since an employer can be in it too.
	add('hometown', text(row.location)?.split(',')[0]);

	const seen = new Set<string>();
	return terms.filter((t) => {
		const key = `${t.kind}:${foldText(t.term)}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/**
 * The document's text as one line, the way a reader runs through it: a word
 * the PDF broke across lines at a hyphen joined again ("rik-" / "wanders"),
 * and every run of whitespace one space.
 */
function readable(value: string): string {
	return value
		.replace(/-\s*\n\s*/g, '-')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Lowercase without accents, one UTF-16 unit for one, so an offset into the
 * folded text is an offset into the readable one and a hit can be quoted as
 * the reader sees it.
 */
function foldUnits(value: string): string {
	let out = '';
	for (const unit of value) {
		const folded = unit.toLowerCase().normalize('NFD')[0];
		out += unit.length === 1 && folded && folded.length === 1 ? folded : unit;
	}
	return out;
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** How a term is looked for in folded text. */
function patternFor(term: IdentityTerm): RegExp {
	if (/^\d+$/.test(term.term)) {
		// Digits with whatever a writer puts between them, and no digit either side,
		// except, for a phone number, the country code or trunk zero in front of
		// it: +31 6…, 0031 6…, 06-….
		const sep = '[\\s\\-./()]*';
		const body = [...term.term].map(escape).join(sep);
		const before =
			term.kind === 'phone'
				? `(?<=(?:^|[^\\d+])(?:(?:\\+|00)\\d{1,3})?${sep}(?:0${sep})?)`
				: '(?<!\\d)';
		return new RegExp(`${before}${body}(?!\\d)`, 'gu');
	}
	const folded = foldUnits(readable(term.term));
	const body = folded.split(' ').map(escape).join('\\s?');
	return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'gu');
}

/** Where the terms turn up in `content`, each with the text around it. */
export function findLeaks(content: string, terms: IdentityTerm[]): LeakHit[] {
	const shown = readable(content);
	const folded = foldUnits(shown);
	const found = terms.flatMap((term) =>
		[...folded.matchAll(patternFor(term))].map((match) => {
			const start = match.index ?? 0;
			return { kind: term.kind, start, end: start + match[0].length };
		})
	);
	// The longest first, and nothing inside one already taken: "Rik Wanders
	// Software" is one hit, not that plus the full name plus each half of it.
	found.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
	const taken: typeof found = [];
	for (const hit of found) {
		if (!taken.some((t) => hit.start < t.end && t.start < hit.end)) taken.push(hit);
	}
	return taken
		.sort((a, b) => a.start - b.start)
		.map(({ kind, start, end }) => ({
			kind,
			term: shown.slice(start, end),
			context: `${start > 40 ? '…' : ''}${shown.slice(Math.max(0, start - 40), end + 40)}${
				end + 40 < shown.length ? '…' : ''
			}`
		}));
}

/**
 * Read a PDF for the terms: its text, the properties a viewer shows (title,
 * author, subject, keywords) and the addresses its links go to.
 */
export async function checkPdf(buffer: Buffer, terms: IdentityTerm[]): Promise<LeakHit[]> {
	const { PDFParse } = await import('pdf-parse');
	// A copy, because pdf.js hands the bytes to its worker and keeps them; and
	// one read after the other, because two at once fight over the document.
	const parser = new PDFParse({ data: new Uint8Array(buffer) });
	try {
		const textResult = await parser.getText();
		const info = await parser.getInfo();
		const properties = ['Title', 'Author', 'Subject', 'Keywords']
			.map((key) => text(info.info?.[key]))
			.filter((value): value is string => !!value);
		const links = info.pages.flatMap((page) => page.links.map((link) => link.url));
		return [
			...findLeaks(textResult.text, terms),
			...properties.flatMap((value) =>
				findLeaks(value, terms).map((hit) => ({ ...hit, context: `PDF title: ${value}` }))
			),
			...links.flatMap((url) =>
				findLeaks(url, terms).map((hit) => ({ ...hit, context: `Link: ${url}` }))
			)
		];
	} finally {
		await parser.destroy();
	}
}

/**
 * The check for a stored PDF: the latest export of one document, read with
 * the profile's own row. Null when there is no file to read yet.
 */
export async function checkStoredPdf(
	profileId: number,
	doc: { type: 'resume' | 'cv'; version: string; template: string | null; locale: string | null }
): Promise<LeakHit[] | null> {
	const stored = await getLatestExportWithFile({
		profileId,
		exportType: doc.type,
		fileType: 'pdf',
		exportFormat: doc.version,
		template: doc.template,
		locale: doc.locale
	});
	if (!stored) return null;
	const row = await db.query.profiles.findFirst({ where: eq(profiles.id, profileId) });
	return checkPdf(stored.buffer, identityTerms(row ?? {}));
}
