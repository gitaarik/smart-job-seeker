/**
 * An application's activity entry as a project source.
 *
 * The two stores had no bridge. A take-home brief, the form the applicant
 * filled in and the email that said they passed all land on the application
 * they belong to — where they feed that application's letters and cheat sheets
 * and nothing else. The project the work was actually done for never sees
 * them, so the assistant, the MCP client and every other application's writing
 * cannot cite them. Re-uploading the same file to the project was the only way
 * across, and it is exactly the step nobody takes.
 *
 * This copies the entry's *text* across, as one more attachment on the project
 * — the same row shape a note or an upload writes, so the summarizer, the
 * embeddings, `loadProjectCorpus` and the citations pick it up without learning
 * anything new. It is a copy, not a link: the entry stays editable on its
 * application, and the project keeps what was true when it was copied. The
 * `source` says where it came from, which is what lets the list link back and
 * lets a second copy be refused.
 */

import { getRecordTypeLabel } from '$lib/application-records';
import type { ApplicationRecordSource } from '$lib/document-sources';
import { type ExtractedProject, extractText, slugForPath } from './extract';
import type { SaveDocumentProjectInput } from './store';

export interface PromotableRecord {
	id: number;
	title: string;
	record_type: string | null;
	content: string;
	/** When it happened, as the column stores it (`YYYY-MM-DD`). */
	event_date: string | null;
	/** The attached file's download name, when the entry came from a file. */
	filename: string | null;
	application: {
		id: number;
		job: { title: string | null; company: string | null } | null;
	};
}

export interface RecordDocument {
	input: Pick<SaveDocumentProjectInput, 'filename' | 'title' | 'kind' | 'source'>;
	extracted: ExtractedProject;
}

function extOf(filename: string | null): string | null {
	const ext = filename?.split('.').pop()?.toLowerCase() ?? '';
	return ext && ext !== filename?.toLowerCase() ? ext : null;
}

/**
 * Where the text came from, in one line the model can read.
 *
 * `buildDocumentBlob` heads each file `=== path ===` and nothing else, so the
 * path prefix and this first line are all a reader has to tell an employer's
 * email from the applicant's own recap — and the proposal prompt treats those
 * differently. The job is named so a project with copies from several
 * applications stays legible.
 */
export function describeRecordOrigin(record: PromotableRecord): string {
	const job = record.application.job;
	const where = [
		job?.title?.trim() ? `for ${job.title.trim()}` : '',
		job?.company?.trim() ? `at ${job.company.trim()}` : ''
	]
		.filter(Boolean)
		.join(' ');
	const what = [getRecordTypeLabel(record.record_type), record.event_date ?? '']
		.filter(Boolean)
		.join(', ');
	return (
		`Source: application entry "${record.title}" (${what})` +
		`${where ? ` — from the application ${where}` : ''}.`
	);
}

/**
 * The entry as an extracted project plus the row fields that name it.
 *
 * Stored under `application/`, with the file's own extension when it came from
 * a file (the way an archive member keeps its extension after extraction) and
 * `.md` when it was typed. A typed entry is not put under `notes/`: that prefix
 * promises the applicant's own words about *this project*, and an entry can as
 * easily be a message the employer sent.
 */
export function buildRecordDocument(record: PromotableRecord): RecordDocument {
	const ext = extOf(record.filename) ?? 'md';
	const path = `application/${slugForPath(record.title, `entry-${record.id}`)}.${ext}`;
	const text = `${describeRecordOrigin(record)}\n\n${record.content}`;
	const source: ApplicationRecordSource = {
		type: 'application_record',
		application_id: record.application.id,
		record_id: record.id,
		record_type: record.record_type,
		filename: record.filename,
		job_title: record.application.job?.title ?? null,
		company: record.application.job?.company ?? null
	};
	return {
		input: {
			filename: record.filename,
			title: record.title,
			kind: 'file',
			source: { ...source }
		},
		extracted: extractText({ path, ext, text })
	};
}
