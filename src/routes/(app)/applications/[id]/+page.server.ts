import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { application_records, applications } from '$lib/server/db/schema';
import { applicationStatusError, writeApplicationStatus } from '$lib/server/applications/status';
import { writeApplicationSnooze } from '$lib/server/applications/snooze';
import { snoozeError } from '$lib/application-snooze';
import { clampRecordTitle, deriveRecordTitle, today } from '$lib/application-records';
import { deriveRecordMetadata } from '$lib/server/ai-chat/record-derivation';
import { summarizeApplication } from '$lib/server/ai-chat/application-summary';
import { getSelectedProfileId } from '../../profile/utils';

/**
 * Put a note on the application's timeline and let the rest of it hear.
 *
 * The note box and "not right?" on the Key facts card both land here, as a
 * `note` entry: the kind the summariser reads as the applicant's own words,
 * above whatever the documents around it say. The same passes as the Activity
 * composer, in its order: derivation first (a title for a long note, the
 * people it names), then the summariser, which rebuilds the key facts with
 * this note in them. The type is passed as decided so derivation cannot
 * re-file a note as a message, and a correction's title as well, so it stays
 * findable as one on the timeline.
 */
async function addNoteEntry(
	app: { id: number; status_step: string | null },
	profileId: number,
	content: string,
	title?: string
): Promise<void> {
	const [created] = await db
		.insert(application_records)
		.values({
			application_id: app.id,
			record_type: 'note',
			title: title ? clampRecordTitle(title) : deriveRecordTitle(content),
			content,
			step: app.status_step,
			event_date: today(),
			extraction_status: 'none',
			date_created: new Date()
		})
		.returning({ id: application_records.id });

	await deriveRecordMetadata(created.id, profileId, {
		decided: { record_type: true, title: !!title }
	});
	await summarizeApplication(app.id, profileId);
}

export const actions: Actions = {
	updateStatus: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const existing = await db.query.applications.findFirst({
			where: and(eq(applications.id, appId), eq(applications.profile_id, profileId))
		});
		if (!existing) return fail(404, { error: 'Application not found' });

		const formData = await request.formData();
		const status = formData.get('status') as string;
		const step = (formData.get('step') as string)?.trim() || null;
		const action = (formData.get('action') as string)?.trim() || null;
		const actionDate = (formData.get('action_date') as string)?.trim() || null;
		const description = (formData.get('description') as string)?.trim() || null;

		const problem = applicationStatusError(status);
		if (problem) return fail(400, { error: problem });

		// Both sides normalised to "" before comparing. They were not, and a null
		// step never equalled the empty string the form posts for one — so this
		// only ever short-circuited when the phase and the action both matched by
		// accident, and every re-save of an unchanged form wrote a timeline row.
		const unchanged =
			status === existing.status &&
			(step ?? '') === (existing.status_step ?? '') &&
			(action ?? '') === (existing.status_action ?? '') &&
			!description;
		if (unchanged) return { success: true };

		const written = await writeApplicationStatus(
			appId,
			profileId,
			{ status, step, action, actionDate, description },
			// The editor is the one caller that may still be correcting the entry
			// the New Application form made a minute ago, rather than recording a
			// move — see the option's own note.
			{ collapseInitialEntry: true }
		);
		if (!written) return fail(404, { error: 'Application not found' });

		return { success: true };
	},

	/**
	 * Pause or resume. The list has the presets; this is the one that takes an
	 * arbitrary date and a reason, and an empty `until` is how you resume —
	 * "no date" and "not paused" are the same state in the column.
	 */
	updateSnooze: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const formData = await request.formData();
		const until = ((formData.get('until') as string) ?? '').trim();
		const reason = ((formData.get('reason') as string) ?? '').trim() || null;

		if (until) {
			const problem = snoozeError(until);
			if (problem) return fail(400, { error: problem });
		}

		const written = await writeApplicationSnooze(appId, profileId, {
			until: until || null,
			reason
		});
		if (!written) return fail(404, { error: 'Application not found' });

		return { success: true };
	},

	/**
	 * A note from the Key facts card. It used to be pushed onto the
	 * `application_notes` list, which nothing but this page ever read; it goes on
	 * the timeline now, so the facts, the assistant and the letters see it. The
	 * older list keeps its edit and delete below for the notes already in it.
	 */
	addNote: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const existing = await db.query.applications.findFirst({
			where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
			columns: { id: true, status_step: true }
		});
		if (!existing) return fail(404, { error: 'Application not found' });

		const formData = await request.formData();
		const text = (formData.get('text') as string)?.trim();
		if (!text) return fail(400, { error: 'Note text is required' });

		await addNoteEntry(existing, profileId, text);
		return { success: true };
	},

	/**
	 * "Not right?" on a key fact. The fact cannot be edited where it stands: the
	 * card is rebuilt from the entries on every change, so an edit would revert on
	 * the next one. What is right goes on the timeline as the applicant's note,
	 * naming the fact and what it said, and the rebuild reads the note as
	 * overriding the entry it came from.
	 */
	correctFact: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const existing = await db.query.applications.findFirst({
			where: and(eq(applications.id, appId), eq(applications.profile_id, profileId)),
			columns: { id: true, status_step: true }
		});
		if (!existing) return fail(404, { error: 'Application not found' });

		const formData = await request.formData();
		const label = ((formData.get('label') as string) ?? '').trim().slice(0, 120);
		const was = ((formData.get('value') as string) ?? '').trim().slice(0, 600);
		const text = ((formData.get('text') as string) ?? '').trim();
		if (!label || !text) return fail(400, { error: 'Say what is right' });

		await addNoteEntry(
			existing,
			profileId,
			`Correction to "${label}": ${text}` +
				(was ? `\n\nThis replaces what was picked out before: ${was}` : ''),
			`Correction: ${label}`
		);
		return { success: true };
	},

	updateNote: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const existing = await db.query.applications.findFirst({
			where: and(eq(applications.id, appId), eq(applications.profile_id, profileId))
		});
		if (!existing) return fail(404, { error: 'Application not found' });

		const formData = await request.formData();
		const noteId = formData.get('note_id') as string;
		const text = (formData.get('text') as string)?.trim();
		if (!text) return fail(400, { error: 'Note text is required' });

		const notes =
			(existing.application_notes as Array<{ id: string; text: string; created_at: string }>) || [];
		const note = notes.find((n) => n.id === noteId);
		if (!note) return fail(404, { error: 'Note not found' });
		note.text = text;

		await db
			.update(applications)
			.set({
				application_notes: notes,
				date_updated: new Date()
			})
			.where(eq(applications.id, appId));

		return { success: true };
	},

	deleteNote: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const existing = await db.query.applications.findFirst({
			where: and(eq(applications.id, appId), eq(applications.profile_id, profileId))
		});
		if (!existing) return fail(404, { error: 'Application not found' });

		const formData = await request.formData();
		const noteId = formData.get('note_id') as string;

		const notes =
			(existing.application_notes as Array<{ id: string; text: string; created_at: string }>) || [];
		const filtered = notes.filter((n) => n.id !== noteId);

		await db
			.update(applications)
			.set({
				application_notes: filtered,
				date_updated: new Date()
			})
			.where(eq(applications.id, appId));

		return { success: true };
	},

	updateDetails: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const existing = await db.query.applications.findFirst({
			where: and(eq(applications.id, appId), eq(applications.profile_id, profileId))
		});
		if (!existing) return fail(404, { error: 'Application not found' });

		const formData = await request.formData();
		const cv_sent_through = formData.get('cv_sent_through') as string;
		const application_sent_date = formData.get('application_sent_date') as string;
		const application_seen_date = formData.get('application_seen_date') as string;

		await db
			.update(applications)
			.set({
				cv_sent_through: cv_sent_through || null,
				// HTML date inputs already yield YYYY-MM-DD; the columns are
				// Drizzle `date()` (string mode), so pass the form value through.
				application_sent_date: application_sent_date || null,
				application_seen_date: application_seen_date || null,
				date_updated: new Date()
			})
			.where(eq(applications.id, appId));

		return { success: true };
	},

	delete: async ({ locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const existing = await db.query.applications.findFirst({
			where: and(eq(applications.id, appId), eq(applications.profile_id, profileId))
		});
		if (!existing) return fail(404, { error: 'Application not found' });

		await db.delete(applications).where(eq(applications.id, appId));

		redirect(303, '/applications/active');
	}
};
