import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { applications } from '$lib/server/db/schema';
import { applicationStatusError, writeApplicationStatus } from '$lib/server/applications/status';
import { getSelectedProfileId } from '../../profile/utils';

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

	addNote: async ({ request, locals, cookies, params }) => {
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
		const text = (formData.get('text') as string)?.trim();
		if (!text) return fail(400, { error: 'Note text is required' });

		const notes =
			(existing.application_notes as Array<{ id: string; text: string; created_at: string }>) || [];
		notes.push({
			id: crypto.randomUUID(),
			text,
			created_at: new Date().toISOString()
		});

		await db
			.update(applications)
			.set({
				application_notes: notes,
				date_updated: new Date()
			})
			.where(eq(applications.id, appId));

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
