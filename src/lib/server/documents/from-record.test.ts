import { describe, expect, it } from 'vitest';
import { buildRecordDocument, describeRecordOrigin, type PromotableRecord } from './from-record';
import { DocumentExtractError, extractText } from './extract';

const base: PromotableRecord = {
	id: 42,
	title: 'Annotate v3 — take-home form',
	record_type: 'assessment',
	content: 'Question 1: describe the bug.\nAnswer: the reducer mutated state.',
	event_date: '2026-05-20',
	filename: 'Annotate v3 (6_25_2026).html',
	application: { id: 25, job: { title: 'Senior Code Reviewer', company: 'G2i' } }
};

describe('describeRecordOrigin', () => {
	it('names the entry, its kind, its date and the application it came from', () => {
		expect(describeRecordOrigin(base)).toBe(
			'Source: application entry "Annotate v3 — take-home form" (Assessment / assignment, 2026-05-20)' +
				' — from the application for Senior Code Reviewer at G2i.'
		);
	});

	it('leaves the application out when the job has neither title nor company', () => {
		const origin = describeRecordOrigin({
			...base,
			event_date: null,
			application: { id: 25, job: null }
		});
		expect(origin).toBe(
			'Source: application entry "Annotate v3 — take-home form" (Assessment / assignment).'
		);
	});
});

describe('buildRecordDocument', () => {
	it('stores a file-backed entry under application/ with the file’s own extension', () => {
		const { input, extracted } = buildRecordDocument(base);
		expect(extracted.files).toHaveLength(1);
		expect(extracted.files[0].path).toBe('application/annotate-v3-take-home-form.html');
		expect(extracted.files[0].ext).toBe('html');
		expect(input.filename).toBe(base.filename);
		expect(input.title).toBe(base.title);
		expect(input.kind).toBe('file');
	});

	it('stores a typed entry as markdown', () => {
		const { extracted } = buildRecordDocument({ ...base, filename: null, record_type: 'note' });
		expect(extracted.files[0].path).toBe('application/annotate-v3-take-home-form.md');
		expect(extracted.files[0].ext).toBe('md');
	});

	it('puts the origin line first and the entry’s text after it', () => {
		const { extracted } = buildRecordDocument(base);
		const [first, blank, ...rest] = extracted.files[0].text.split('\n');
		expect(first).toBe(describeRecordOrigin(base));
		expect(blank).toBe('');
		expect(rest.join('\n')).toBe(base.content);
	});

	it('writes provenance the list can link back with', () => {
		const { input } = buildRecordDocument(base);
		expect(input.source).toEqual({
			type: 'application_record',
			application_id: 25,
			record_id: 42,
			record_type: 'assessment',
			filename: base.filename,
			job_title: 'Senior Code Reviewer',
			company: 'G2i'
		});
	});

	it('redacts a secret the entry carried, like an upload would', () => {
		const { extracted } = buildRecordDocument({
			...base,
			content: 'They gave me an AWS key: AKIAIOSFODNN7EXAMPLE - do not share.'
		});
		expect(extracted.files[0].text).not.toContain('AKIAIOSFODNN7EXAMPLE');
		expect(extracted.secretsRedacted).toBe(1);
	});

	it('falls back to the entry id when the title has nothing to slug', () => {
		const { extracted } = buildRecordDocument({ ...base, title: '???', filename: null });
		expect(extracted.files[0].path).toBe('application/entry-42.md');
	});

	it('counts the quota in UTF-8 bytes of what is stored', () => {
		const { extracted } = buildRecordDocument(base);
		expect(extracted.totalBytes).toBe(Buffer.byteLength(extracted.files[0].text, 'utf8'));
		expect(extracted.totalChars).toBe(extracted.files[0].text.length);
	});
});

describe('extractText', () => {
	it('refuses text with nothing in it', () => {
		expect(() => extractText({ path: 'a.md', ext: 'md', text: '  \n ' })).toThrow(
			DocumentExtractError
		);
	});

	it('keeps the path the caller chose', () => {
		const out = extractText({ path: 'application/x.eml', ext: 'eml', text: 'Subject: hi' });
		expect(out.kind).toBe('file');
		expect(out.files[0]).toMatchObject({ path: 'application/x.eml', ext: 'eml', chars: 11 });
	});
});
