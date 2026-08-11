import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { and, eq, isNull } from 'drizzle-orm';
import { application_status_log, applications } from '$lib/server/db/schema';
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

		const phaseChanged = status !== existing.status;
		const stepChanged = step !== (existing.status_step || '');
		const actionChanged = action !== (existing.status_action || '');

		// Nothing changed
		if (!phaseChanged && !stepChanged && !actionChanged && !description) {
			return { success: true };
		}

		const now = new Date();
		const updateData: Record<string, unknown> = {
			status,
			status_step: step,
			status_action: action,
			status_action_date: actionDate || null,
			date_updated: now
		};

		// Auto-set applied date when moving past "Preparing",
		// or when moving past the applying phase
		if (!existing.application_sent_date) {
			if (
				(status === 'applying' && step && step !== 'Preparing') ||
				(status !== 'applying' && status !== 'draft')
			) {
				updateData.application_sent_date = now;
			}
		}

		// Clear step/action when phase changes (unless new ones were selected)
		if (phaseChanged && !step) {
			updateData.status_step = null;
		}
		if (phaseChanged && !action) {
			updateData.status_action = null;
		}

		await db.update(applications).set(updateData).where(eq(applications.id, appId));

		// If still in the initial phase (from_status is null = the creation entry),
		// and the phase hasn't changed, replace that initial entry instead of creating a new one.
		// Once the initial entry has been replaced (or phase changes), always create new entries.
		let replaced = false;
		if (!phaseChanged) {
			const initialEntry = await db.query.application_status_log.findFirst({
				where: and(
					eq(application_status_log.application, appId),
					isNull(application_status_log.from_status)
				)
			});

			// Count total log entries — only replace if the initial entry is the only one
			const allEntries = await db.query.application_status_log.findMany({
				where: eq(application_status_log.application, appId),
				columns: { id: true }
			});

			if (initialEntry && allEntries.length === 1) {
				await db
					.update(application_status_log)
					.set({
						step,
						action,
						action_date: actionDate || null,
						description: description || null,
						date_created: now
					})
					.where(eq(application_status_log.id, initialEntry.id));
				replaced = true;
			}
		}

		if (!replaced) {
			await db.insert(application_status_log).values({
				application: appId,
				date_created: now,
				from_status: existing.status,
				to_status: status,
				step,
				action,
				action_date: actionDate || null,
				description: description || null
			});
		}

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
