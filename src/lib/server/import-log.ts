/**
 * Import event logging — writes to import_logs DB table.
 * Used by the resume parse endpoint and the diff apply action.
 */

import { dbDirect as db } from '$lib/server/db';
import { import_logs } from '$lib/server/db/schema';
import type { ResumeData } from '$lib/server/resume/types';
import type { DiffApplyPayload } from '$lib/server/resume/apply-diff';

type User = { id: string; email?: string | null };

function summariseSections(data: ResumeData) {
	const sections: Record<string, number> = {};
	const basicsFields = Object.entries(data.basics).filter(([, v]) => v && String(v).trim());
	if (basicsFields.length > 0) sections.basics = basicsFields.length;
	if (data.work?.length) sections.work = data.work.length;
	if (data.education?.length) sections.education = data.education.length;
	if (data.skills?.length) sections.skills = data.skills.length;
	if (data.languages?.length) sections.languages = data.languages.length;
	if (data.projects?.length) sections.projects = data.projects.length;
	if (data.references?.length) sections.references = data.references.length;
	return sections;
}

function detectDocType(data: ResumeData): 'partial' | 'full' {
	const present = [
		data.work,
		data.education,
		data.skills,
		data.languages,
		data.projects,
		data.references
	].filter((s) => s !== undefined && s.length > 0).length;
	return present <= 2 ? 'partial' : 'full';
}

function summariseChanges(payload: DiffApplyPayload) {
	const changes: Record<string, Record<string, number>> = {};
	if (payload.basics) {
		changes.basics = { fields: Object.keys(payload.basics).length };
	}
	for (const key of [
		'work',
		'education',
		'skills',
		'languages',
		'projects',
		'references'
	] as const) {
		const section = payload[key];
		if (!section) continue;
		const counts: Record<string, number> = {};
		if ((section as { added?: unknown[] }).added?.length)
			counts.added = (section as { added: unknown[] }).added.length;
		if ((section as { modified?: unknown[] }).modified?.length)
			counts.modified = (section as { modified: unknown[] }).modified.length;
		if ((section as { removed?: unknown[] }).removed?.length)
			counts.removed = (section as { removed: unknown[] }).removed.length;
		if (Object.keys(counts).length > 0) changes[key] = counts;
	}
	return changes;
}

interface ParseOpts {
	fileName: string;
	fileFormat: string;
	parsedData: ResumeData;
	fileId?: string;
}

interface ParseErrorOpts {
	fileName: string;
	fileFormat: string;
	error: string;
	fileId?: string;
}

interface ApplyOpts {
	profileId: number;
	payload: DiffApplyPayload;
}

interface ApplyErrorOpts {
	profileId: number;
	error: string;
}

type EventMap = {
	parse: ParseOpts;
	parse_error: ParseErrorOpts;
	apply: ApplyOpts;
	apply_error: ApplyErrorOpts;
};

export async function logImportEvent<E extends keyof EventMap>(
	user: User,
	event: E,
	opts: EventMap[E]
): Promise<void> {
	try {
		if (event === 'parse') {
			const { fileName, fileFormat, parsedData, fileId } = opts as ParseOpts;
			const sections = summariseSections(parsedData);
			const docType = detectDocType(parsedData);
			console.log(
				`[Import] Parse: user=${user.email || user.id} file="${fileName}" format=${fileFormat} type=${docType} sections=${JSON.stringify(sections)}`
			);
			await db.insert(import_logs).values({
				user_id: user.id,
				user_email: user.email ?? null,
				event: 'parse',
				file_name: fileName,
				file_format: fileFormat,
				doc_type: docType,
				sections: sections as Record<string, unknown>,
				parsed_data: parsedData as unknown as Record<string, unknown>,
				file_id: fileId ?? null
			});
		} else if (event === 'parse_error') {
			const { fileName, fileFormat, error, fileId } = opts as ParseErrorOpts;
			console.error(
				`[Import] Parse failed: user=${user.email || user.id} file="${fileName}" format=${fileFormat} error="${error}"`
			);
			await db.insert(import_logs).values({
				user_id: user.id,
				user_email: user.email ?? null,
				event: 'parse_error',
				file_name: fileName,
				file_format: fileFormat,
				file_id: fileId ?? null,
				error
			});
		} else if (event === 'apply') {
			const { profileId, payload } = opts as ApplyOpts;
			const changes = summariseChanges(payload);
			console.log(
				`[Import] Apply: user=${user.email || user.id} profile=${profileId} changes=${JSON.stringify(changes)}`
			);
			await db.insert(import_logs).values({
				user_id: user.id,
				user_email: user.email ?? null,
				profile_id: profileId,
				event: 'apply',
				changes: changes as Record<string, unknown>
			});
		} else if (event === 'apply_error') {
			const { profileId, error } = opts as ApplyErrorOpts;
			console.error(
				`[Import] Apply failed: user=${user.email || user.id} profile=${profileId} error="${error}"`
			);
			await db.insert(import_logs).values({
				user_id: user.id,
				user_email: user.email ?? null,
				profile_id: profileId,
				event: 'apply_error',
				error
			});
		}
	} catch (err) {
		// Never let logging failures break the main flow
		console.error('[Import] Failed to write import log:', err);
	}
}
