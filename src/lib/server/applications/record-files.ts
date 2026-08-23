/**
 * Putting a file on an activity entry, and reading it once it is there.
 *
 * Written when MCP grew an upload door, and sharing `readFileIntoRecord` with
 * the activity page's `extract` action — which is the half that was genuinely
 * duplicated. The rest is not: the page splits creating the entry from reading
 * the file across two requests so a forty-page PDF does not hold the composer
 * open, where an upload arrives as one PUT and has nothing to hold open. Two
 * shapes, one ordering, and the ordering is the part that breaks quietly.
 *
 * ## The order is the whole thing
 *
 * Store the bytes, point the record at them, read the text out, and only then
 * derive and summarise. Derivation is what gives a file-backed entry its real
 * title, type, date and contacts, and it has nothing to read until extraction
 * has run — which is why the page splits `create` from `extract` across two
 * requests and derives in the second. A caller that derived first would title
 * every attachment after its filename and never correct it.
 *
 * ## Why a filled slot is refused rather than replaced
 *
 * `application_records.file_id` is documented as immutable, and the extraction
 * states lean on that: "extracted" and "skipped" are terminal. Swapping the file
 * under a record that has already been read would leave content extracted from
 * a file that is no longer there, with nothing to say so. It is also what makes
 * an upload grant single-use without anything having to remember it was spent.
 */

import { and, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { application_records } from '$lib/server/db/schema';
import { uploadFile } from '$lib/server/files';
import { extractRecordFile } from '$lib/server/ai-chat/application-activity';
import { deriveRecordMetadata } from '$lib/server/ai-chat/record-derivation';
import { summarizeApplication } from '$lib/server/ai-chat/application-summary';

/** An entry a file could go on, as far as the grant-minting side needs to know. */
export interface AttachableRecord {
	id: number;
	title: string;
	hasFile: boolean;
}

/**
 * The entry a grant would name, or null when it is not on that application.
 *
 * Lives here rather than in the MCP layer because the question it answers is
 * this module's: whether the slot is free. The answer is advisory — the claim
 * is still decided by the conditional UPDATE below, minutes later — so this is
 * only ever the difference between a refusal the agent reads and one the
 * uploader gets.
 */
export async function findAttachableRecord(
	recordId: number,
	applicationId: number
): Promise<AttachableRecord | null> {
	const row = await db.query.application_records.findFirst({
		where: and(
			eq(application_records.id, recordId),
			eq(application_records.application_id, applicationId)
		),
		columns: { id: true, title: true, file_id: true }
	});
	return row ? { id: row.id, title: row.title, hasFile: !!row.file_id } : null;
}

export interface AttachFileInput {
	recordId: number;
	applicationId: number;
	profileId: number;
	filename: string;
	buffer: Buffer;
}

export interface AttachedFile {
	fileId: string;
	/**
	 * Whether any text came out of it.
	 *
	 * False is a normal outcome, not a failure: a photograph and a scan with no
	 * text layer are both files worth keeping and neither has anything to read.
	 * `extractRecordFile` has already marked those "skipped" so nothing retries.
	 */
	extracted: boolean;
}

/** Why an attach was refused, in words the caller can hand on unchanged. */
export type AttachRefusal = { error: string };

/**
 * Store a file against an entry that has none, then read it into the entry.
 *
 * The claim on the record is made with a conditional UPDATE rather than a read
 * followed by a write: two uploads racing on one grant would both pass a check
 * that ran a statement earlier, and `file_id IS NULL` in the WHERE clause is the
 * same test decided by the database, once. The loser is told the slot is taken,
 * which is also the answer a replayed grant gets.
 */
export async function attachFileToRecord(
	input: AttachFileInput
): Promise<AttachedFile | AttachRefusal> {
	// Stored before the claim, so the claim is a single statement. A file whose
	// record turns out to be taken is left on disk for the uploads reaper rather
	// than deleted here — see `uploads/reap.ts`, which exists because a `files`
	// row and its blob are written by different steps and either can be orphaned.
	const stored = await uploadFile({
		filename: input.filename,
		buffer: input.buffer,
		title: input.filename
	});

	const claimed = await db
		.update(application_records)
		.set({ file_id: stored.id, extraction_status: 'pending' })
		.where(
			and(
				eq(application_records.id, input.recordId),
				eq(application_records.application_id, input.applicationId),
				isNull(application_records.file_id)
			)
		)
		.returning({ id: application_records.id });

	if (claimed.length === 0) {
		return {
			error:
				`Entry ${input.recordId} already has a file, or does not belong to ` +
				`application ${input.applicationId}. A file cannot be replaced once it is ` +
				`attached — add a new entry for the new file.`
		};
	}

	const extracted = await readFileIntoRecord(input.recordId, input.applicationId, input.profileId);

	return { fileId: stored.id, extracted };
}

/**
 * Read an attached file into its entry, then let the rest of the application
 * hear about it.
 *
 * The ordering both doors need, in one place. Derivation is what gives a
 * file-backed entry its real title, type, date and contacts, and it has nothing
 * to read until extraction has run — so a caller that derived first would title
 * every attachment after its filename and never correct it. The summariser runs
 * last for the same reason: it should digest the derived entry, not the
 * write-time fallbacks.
 *
 * Returns whether any text came out. False is a normal outcome, not a failure —
 * a photograph and a scan with no text layer are both worth keeping and neither
 * has anything to read. `extractRecordFile` has already marked those "skipped",
 * so nothing retries them.
 */
export async function readFileIntoRecord(
	recordId: number,
	applicationId: number,
	profileId: number
): Promise<boolean> {
	const text = await extractRecordFile(recordId);
	if (!text) return false;

	// Best-effort by construction: a failure in either leaves the entry written,
	// the file attached and the download working.
	await deriveRecordMetadata(recordId, profileId);
	await summarizeApplication(applicationId, profileId);
	return true;
}
