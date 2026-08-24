/**
 * Provenance of a project document that was copied from an application entry.
 *
 * `profile_document_projects.source` is an open jsonb — an upload, a repository
 * scan and a pasted note each write their own shape — and this is the shape an
 * application entry writes. Client-safe on purpose: the Files & code list reads
 * it to say where a document came from and link back, and the server writes it,
 * so it belongs to neither side.
 */

export interface ApplicationRecordSource {
	type: 'application_record';
	application_id: number;
	record_id: number;
	record_type: string | null;
	/** The attached file's download name, when the entry came from a file. */
	filename: string | null;
	job_title: string | null;
	company: string | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

/** The source as an application-record source, or null when it is anything else. */
export function applicationRecordSource(source: unknown): ApplicationRecordSource | null {
	if (!source || typeof source !== 'object') return null;
	const s = source as Record<string, unknown>;
	if (s.type !== 'application_record') return null;
	if (typeof s.application_id !== 'number' || typeof s.record_id !== 'number') return null;
	return {
		type: 'application_record',
		application_id: s.application_id,
		record_id: s.record_id,
		record_type: str(s.record_type),
		filename: str(s.filename),
		job_title: str(s.job_title),
		company: str(s.company)
	};
}
