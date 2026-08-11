import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import {
	application_status_log,
	applications,
	profile_version_extensions,
	profile_version_overrides,
	profile_versions
} from '$lib/server/db/schema';
import { getSelectedProfileId } from '../../profile/utils';
import { getVersionCoverage } from '$lib/server/profile/hidden-required-skills';
import {
	decisionsForVersion,
	describeOverrides,
	jobMatchGaps,
	promoteToLibrary,
	tailorVersionForApplication
} from '$lib/server/profile/tailor-version';

/**
 * The version list and the coverage map feed CvSentCard, which moved here from
 * the Documents tab: "which version did I send them?" is application state, not
 * activity, and it was the one thing on that page unrelated to attached files.
 */
export const load: PageServerLoad = async ({ parent, params }) => {
	const layoutData = await parent();
	if (!layoutData.selectedProfile) return {};

	const requiredSkills = layoutData.application?.job?.skills_required;
	const applicationId = parseInt(params.id);

	const [profileVersions, coverage] = await Promise.all([
		db.query.profile_versions.findMany({
			// The applicant's library, plus this application's own tailored version
			// if one exists. Versions belonging to OTHER applications are somebody
			// else's business and never appear in this picker.
			where: and(
				eq(profile_versions.profile_id, layoutData.selectedProfile.id),
				eq(profile_versions.status, 'published'),
				isNaN(applicationId)
					? isNull(profile_versions.application_id)
					: or(
							isNull(profile_versions.application_id),
							eq(profile_versions.application_id, applicationId)
						)
			),
			columns: { id: true, slug: true, name: true, application_id: true },
			orderBy: asc(profile_versions.sort)
		}),
		// Precomputed for every template x version pair rather than just the saved
		// one: the type and version pickers are unsaved client state, so the page
		// must be able to answer for whatever the applicant is currently eyeing.
		getVersionCoverage(
			layoutData.selectedProfile.id,
			Array.isArray(requiredSkills) ? (requiredSkills as string[]) : [],
			{ applicationId: isNaN(applicationId) ? null : applicationId }
		)
	]);

	const usable = profileVersions.filter((v) => v.slug && v.name) as {
		id: number;
		slug: string;
		name: string;
		application_id: number | null;
	}[];

	const tailoredRow = usable.find((v) => v.application_id !== null) ?? null;

	// Which library version it currently extends. The regenerate control has to
	// show the real answer: defaulting it back to the recommendation would
	// silently rebase the version on the next regenerate.
	const currentBase = tailoredRow
		? await db.query.profile_version_extensions.findFirst({
				where: eq(profile_version_extensions.extender_id, tailoredRow.id),
				columns: { extended_id: true }
			})
		: null;
	const tailored = tailoredRow
		? {
				...tailoredRow,
				baseSlug:
					usable.find((v) => v.id === currentBase?.extended_id)?.slug ??
					(currentBase?.extended_id ? null : '')
			}
		: null;

	// The annotated diff, and what selection cannot fix. Both only matter once a
	// tailored version exists, so neither costs anything until then.
	const [decisions, gaps] = await Promise.all([
		tailored ? decisionsForVersion(tailored.id).then(describeOverrides) : Promise.resolve([]),
		layoutData.application?.job?.id
			? jobMatchGaps(layoutData.selectedProfile.id, layoutData.application.job.id)
			: Promise.resolve([])
	]);

	return {
		versions: usable
			.filter((v) => v.application_id === null)
			.map(({ slug, name }) => ({ slug, name })),
		tailored,
		coverage,
		decisions,
		gaps
	};
};

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
	},

	/**
	 * Generate — or regenerate — the version tailored to this job.
	 *
	 * The base version is the applicant's choice, defaulting to whatever the
	 * coverage ranking recommends: a tailored version is a DELTA on a library
	 * version, so which one it extends is the most consequential input here.
	 */
	tailorVersion: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const formData = await request.formData();
		const docType = (formData.get('doc_type') as string) === 'cv' ? 'cv' : 'resume';
		const baseSlug = ((formData.get('base_slug') as string) || '').trim();

		try {
			const result = await tailorVersionForApplication({
				profileId,
				applicationId: appId,
				docType,
				baseSlug
			});
			return { success: true, tailored: result };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Could not tailor a version.'
			});
		}
	},

	/**
	 * Reject one proposed decision. Deleting the row is the whole undo: the item
	 * falls back to what the applicant's own tags say, which is where it was
	 * before anything was generated.
	 */
	rejectDecision: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		const formData = await request.formData();
		const decisionId = parseInt((formData.get('decision_id') as string) || '');
		if (isNaN(decisionId) || isNaN(appId)) return fail(400, { error: 'Invalid decision' });

		// Ownership: the row must belong to a version owned by THIS application,
		// which must belong to the selected profile.
		const version = await db.query.profile_versions.findFirst({
			where: and(
				eq(profile_versions.profile_id, profileId),
				eq(profile_versions.application_id, appId)
			),
			columns: { id: true }
		});
		if (!version) return fail(404, { error: 'No tailored version for this application' });

		await db
			.delete(profile_version_overrides)
			.where(
				and(
					eq(profile_version_overrides.id, decisionId),
					eq(profile_version_overrides.version_id, version.id)
				)
			);
		return { success: true };
	},

	/**
	 * Keep one decision through future regenerations by marking it the
	 * applicant's own — `source` is what stops a rerun undoing a judgement
	 * somebody made by hand.
	 */
	keepDecision: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		const formData = await request.formData();
		const decisionId = parseInt((formData.get('decision_id') as string) || '');
		if (isNaN(decisionId) || isNaN(appId)) return fail(400, { error: 'Invalid decision' });

		const version = await db.query.profile_versions.findFirst({
			where: and(
				eq(profile_versions.profile_id, profileId),
				eq(profile_versions.application_id, appId)
			),
			columns: { id: true }
		});
		if (!version) return fail(404, { error: 'No tailored version for this application' });

		await db
			.update(profile_version_overrides)
			.set({ source: 'user', date_updated: new Date() })
			.where(
				and(
					eq(profile_version_overrides.id, decisionId),
					eq(profile_version_overrides.version_id, version.id)
				)
			);
		return { success: true };
	},

	/**
	 * Keep this version: move it into the library, decisions and all.
	 *
	 * The applicant is saying the selection made for one job is a document worth
	 * reusing — so it keeps its overrides and stops being tied to this
	 * application's lifecycle. It also stops being regenerable from here, which
	 * is the trade: a library version is theirs to edit, not ours to overwrite.
	 */
	promoteTailored: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const formData = await request.formData();
		const name = ((formData.get('name') as string) || '').trim();

		try {
			const promoted = await promoteToLibrary({ profileId, applicationId: appId, name });
			return { success: true, promoted };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Could not promote this version.'
			});
		}
	},

	/** Throw the tailored version away; its decisions cascade with it. */
	discardTailored: async ({ locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const doomed = await db.query.profile_versions.findFirst({
			where: and(
				eq(profile_versions.profile_id, profileId),
				eq(profile_versions.application_id, appId)
			),
			columns: { id: true, slug: true }
		});
		if (!doomed) return { success: true };

		await db.delete(profile_versions).where(eq(profile_versions.id, doomed.id));

		// Clear the record only if it pointed at the version just deleted, which
		// would now render as a broken link. An applicant who recorded sending a
		// LIBRARY version said something true, and discarding this draft must not
		// erase it.
		if (doomed.slug) {
			await db
				.update(applications)
				.set({ cv_version_sent: null, date_updated: new Date() })
				.where(
					and(
						eq(applications.id, appId),
						eq(applications.profile_id, profileId),
						eq(applications.cv_version_sent, doomed.slug)
					)
				);
		}
		return { success: true };
	},

	setCvSent: async ({ request, locals, cookies, params }) => {
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
		const versionSlug = (formData.get('version_slug') as string) || null;
		const cvSentThrough = (formData.get('cv_sent_through') as string) || null;

		await db
			.update(applications)
			.set({
				cv_version_sent: versionSlug,
				cv_sent_through: cvSentThrough,
				date_updated: new Date()
			})
			.where(eq(applications.id, appId));

		return { success: true };
	}
};
