/**
 * Parse an RFC822/MIME email (.eml) into readable text for AI context.
 *
 * Recruiter emails arrive as full MIME — multipart/alternative with
 * quoted-printable or base64 parts, RFC2047-encoded headers, arbitrary
 * charsets. postal-mime (dependency-free, pure ESM) handles all of that; we
 * take its decoded plain-text part (or strip the HTML alternative when there
 * is no plain one) and prepend the headers that carry context: who sent it,
 * when, and about what.
 */

import { Buffer } from 'node:buffer';
import PostalMime from 'postal-mime';
import { extractTextFromFile } from '../resume/text-extractor';

export async function parseEmailToText(bytes: Uint8Array): Promise<string> {
	const email = await PostalMime.parse(bytes);

	const headers: string[] = [];
	if (email.subject?.trim()) headers.push(`Subject: ${email.subject.trim()}`);
	if (email.from) {
		const who = [email.from.name, email.from.address].filter(Boolean).join(' ').trim();
		if (who) headers.push(`From: ${who}`);
	}
	if (email.date) headers.push(`Date: ${email.date}`);

	let body = email.text?.trim() ?? '';
	if (!body && email.html?.trim()) {
		// No plain-text part — strip the HTML alternative with the shared stripper.
		try {
			body = await extractTextFromFile(Buffer.from(email.html, 'utf8'), 'text/html');
		} catch {
			body = '';
		}
	}

	return [headers.join('\n'), body]
		.filter((s) => s.trim())
		.join('\n\n')
		.trim();
}
