/**
 * Tests for preparing a posting's text for the extraction prompt.
 *
 * The behaviour worth pinning is the split: a captured page goes through the
 * HTML stripper (which deletes newlines, correctly — they are indentation), a
 * paste does not (its newlines are its only structure). Before the split every
 * paste was stripped, and a two-line headline was stored as one fused title.
 */
import { describe, expect, it } from 'vitest';
import { looksLikeHtml, normalizePlainTextPosting, prepareJobTextForLlm } from '../posting-text';

const PASTE = `Senior FS for supplier intelligence products
Full-stack Web Developer | Senior
Involvement

40h / week`;

describe('looksLikeHtml', () => {
	it('recognises a captured page', () => {
		expect(looksLikeHtml('<html><body><h1>Engineer</h1></body></html>')).toBe(true);
		expect(looksLikeHtml('<!DOCTYPE html><div>x</div>')).toBe(true);
	});

	it('recognises a fragment with a few tags', () => {
		expect(looksLikeHtml('<div><h1>Engineer</h1><p>Remote</p></div>')).toBe(true);
	});

	it('leaves pasted text alone', () => {
		expect(looksLikeHtml(PASTE)).toBe(false);
		expect(looksLikeHtml('We are hiring a data engineer in Lisbon.')).toBe(false);
	});

	// One stray tag or comparison in a paste is not a page.
	it('tolerates a stray tag or angle bracket in text', () => {
		expect(looksLikeHtml('Salary <b>competitive</b>, 5 > 3 years')).toBe(false);
		expect(looksLikeHtml('email me <today> for details')).toBe(false);
	});
});

describe('normalizePlainTextPosting', () => {
	it('keeps every line break', () => {
		expect(normalizePlainTextPosting(PASTE).split('\n')).toEqual([
			'Senior FS for supplier intelligence products',
			'Full-stack Web Developer | Senior',
			'Involvement',
			'',
			'40h / week'
		]);
	});

	it('unifies line endings and trims lines', () => {
		expect(normalizePlainTextPosting('Title  \r\n  Company\t\r\n')).toBe('Title\nCompany');
	});

	it('collapses runs of blank lines to one', () => {
		expect(normalizePlainTextPosting('Requirements\n\n\n\n\n- Python')).toBe(
			'Requirements\n\n- Python'
		);
	});

	it('collapses horizontal whitespace, including non-breaking spaces', () => {
		expect(normalizePlainTextPosting('Data  Engineer   in\tLisbon')).toBe(
			'Data Engineer in Lisbon'
		);
	});

	it('drops zero-width characters a web paste carries', () => {
		expect(normalizePlainTextPosting('\ufeffSenior\u200b Engineer')).toBe('Senior Engineer');
	});
});

describe('prepareJobTextForLlm', () => {
	it('strips a page down to its content', () => {
		const prepared = prepareJobTextForLlm(
			'<html><body>\n  <script>x()</script>\n  <h1>Engineer</h1>\n</body></html>'
		);
		expect(prepared).toContain('<h1>Engineer</h1>');
		expect(prepared).not.toContain('script');
		expect(prepared).not.toContain('\n');
	});

	// The regression: run through the stripper, the two headline lines became
	// "…productsFull-stack Web Developer" and were stored as the title.
	it('does not fuse the lines of a paste', () => {
		const prepared = prepareJobTextForLlm(PASTE);
		expect(prepared).toContain('products\nFull-stack');
		expect(prepared).not.toContain('productsFull');
		expect(prepared).not.toContain('<body>');
	});

	it('leaves an ampersand in a paste as typed', () => {
		expect(prepareJobTextForLlm('R&D Engineer\nAcme & Sons')).toBe('R&D Engineer\nAcme & Sons');
	});
});
