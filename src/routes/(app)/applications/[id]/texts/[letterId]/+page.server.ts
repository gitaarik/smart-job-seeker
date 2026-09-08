import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { application_letters, applications } from '$lib/server/db/schema';
import { getSelectedProfileId } from '../../../../profile/utils';
import {
	buildConversation,
	type ConversationEntry,
	deleteVersionEntry,
	ensureBaselineVersion,
	type DeleteScope,
	LETTER_VERSIONS,
	recordVersion,
	recordVersionIfChanged,
	trimVersionsAfter,
	type VersionSource
} from '$lib/server/ai-chat/entity-versions';
import { isGenerating } from '$lib/server/ai-chat/ai-generation-status';

// Version `source` values and the ConversationEntry shape live in the shared
// engine; re-export the type so +page.svelte keeps importing it from here.
export type { ConversationEntry } from '$lib/server/ai-chat/entity-versions';

export const load: PageServerLoad = async ({ parent, params, url }) => {
	const layoutData = await parent();
	const application = layoutData.application;

	// Handle "new" letter (not yet created in DB)
	if (params.letterId === 'new') {
		const letterType = url.searchParams.get('type') || 'cover_letter';
		return {
			isNew: true,
			letter: {
				id: 0,
				letter_type: letterType,
				status: 'draft',
				content: null,
				ai_chat_id: null,
				ai_chat_response: null,
				date_created: new Date(),
				date_updated: null
			},
			conversation: [],
			generating: false
		};
	}

	const letterId = parseInt(params.letterId);
	if (isNaN(letterId)) {
		error(400, 'Invalid letter ID');
	}

	const letter = application.application_letters.find((l) => l.id === letterId);

	if (!letter) {
		error(404, 'Letter not found');
	}

	let conversation = await buildConversation(LETTER_VERSIONS, letterId);

	// Letters written before the version trail existed have no rows — surface the
	// saved content as an initial version so the timeline isn't blank. The first
	// AI/save turn persists this baseline for real (ensureBaselineVersion).
	if (conversation.length === 0 && letter.content) {
		const initial: ConversationEntry = {
			versionId: -1,
			type: 'manual_edit',
			content: letter.content,
			aiFeedback: null,
			userRequest: null,
			date: letter.date_updated ?? letter.date_created ?? null
		};
		conversation = [initial];
	}

	return {
		isNew: false,
		letter,
		conversation,
		generating: await isGenerating('letter', letterId)
	};
};

export const actions: Actions = {
	create: async ({ request, locals, cookies, params }) => {
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
		const letterType = formData.get('letter_type') as string;
		const content = formData.get('content') as string | null;
		const source = (formData.get('source') as string) || 'manual_edit';

		if (!letterType) return fail(400, { error: 'Letter type is required' });

		const [newLetter] = await db
			.insert(application_letters)
			.values({
				application_id: appId,
				letter_type: letterType,
				content: content || null,
				status: 'draft',
				date_created: new Date()
			})
			.returning();

		// If content was provided, also create a version
		if (content) {
			await recordVersion(LETTER_VERSIONS, {
				entityId: newLetter.id,
				content,
				source: source as VersionSource
			});
		}

		redirect(303, `/applications/${appId}/texts/${newLetter.id}`);
	},

	update: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const letterId = parseInt(params.letterId);
		if (isNaN(letterId)) return fail(400, { error: 'Invalid letter ID' });

		const existing = await db.query.applications.findFirst({
			where: and(eq(applications.id, appId), eq(applications.profile_id, profileId))
		});
		if (!existing) return fail(404, { error: 'Application not found' });

		const letter = await db.query.application_letters.findFirst({
			where: and(
				eq(application_letters.id, letterId),
				eq(application_letters.application_id, appId)
			)
		});
		if (!letter) return fail(404, { error: 'Letter not found' });

		const formData = await request.formData();
		const content = formData.get('content') as string;
		const status = formData.get('status') as string;
		const source = (formData.get('source') as string) || 'manual_edit';
		const deleteAfterVersionId = formData.get('deleteAfterVersionId');

		// If saving a previous version, delete all versions after it first. What the
		// save is then a change *to* is the version it rewound onto, not the letter
		// the trimmed versions had left behind.
		let previousContent = letter.content;
		if (deleteAfterVersionId) {
			const afterId = parseInt(deleteAfterVersionId as string);
			if (!isNaN(afterId)) {
				const { remainingContent } = await trimVersionsAfter(LETTER_VERSIONS, letterId, afterId);
				previousContent = remainingContent;
			}
		}

		// Preserve a pre-version-era letter as a baseline before recording this save.
		await ensureBaselineVersion(LETTER_VERSIONS, letterId, letter.content);

		await db
			.update(application_letters)
			.set({
				content: content || null,
				status: status || 'draft',
				date_updated: new Date()
			})
			.where(eq(application_letters.id, letterId));

		// Only records when content actually changed and is non-empty.
		await recordVersionIfChanged(LETTER_VERSIONS, {
			entityId: letterId,
			newContent: content || null,
			previousContent,
			source: source as VersionSource
		});

		return { success: true };
	},

	// Apply a specific version's content as the live letter, without trimming any
	// later versions — a non-destructive "use this version" pointer update. The
	// content already exists as a version, so no new version is recorded.
	applyVersion: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const letterId = parseInt(params.letterId);
		if (isNaN(letterId)) return fail(400, { error: 'Invalid letter ID' });

		const existing = await db.query.applications.findFirst({
			where: and(eq(applications.id, appId), eq(applications.profile_id, profileId))
		});
		if (!existing) return fail(404, { error: 'Application not found' });

		const letter = await db.query.application_letters.findFirst({
			where: and(
				eq(application_letters.id, letterId),
				eq(application_letters.application_id, appId)
			)
		});
		if (!letter) return fail(404, { error: 'Letter not found' });

		const formData = await request.formData();
		const content = (formData.get('content') as string | null)?.trim() || null;
		if (!content) return fail(400, { error: 'Nothing to apply' });

		await db
			.update(application_letters)
			.set({
				content,
				date_updated: new Date()
			})
			.where(eq(application_letters.id, letterId));

		return { success: true };
	},

	// Remove one entry from the letter's version trail, rewinding the thread to
	// just before it. `scope` says whether the applicant's own message survives.
	deleteEntry: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const letterId = parseInt(params.letterId);
		if (isNaN(letterId)) return fail(400, { error: 'Invalid letter ID' });

		const existing = await db.query.applications.findFirst({
			where: and(eq(applications.id, appId), eq(applications.profile_id, profileId))
		});
		if (!existing) return fail(404, { error: 'Application not found' });

		const letter = await db.query.application_letters.findFirst({
			where: and(
				eq(application_letters.id, letterId),
				eq(application_letters.application_id, appId)
			)
		});
		if (!letter) return fail(404, { error: 'Letter not found' });

		const formData = await request.formData();
		const versionId = parseInt(formData.get('versionId') as string);
		if (isNaN(versionId)) return fail(400, { error: 'Invalid version' });
		const scope: DeleteScope = formData.get('scope') === 'response' ? 'response' : 'turn';

		const { existed, aiChatId, liveContent, rewind } = await deleteVersionEntry(
			LETTER_VERSIONS,
			letterId,
			versionId,
			{ scope, committedContent: letter.content }
		);
		if (!existed) return fail(404, { error: 'Version not found' });

		await db
			.update(application_letters)
			.set({
				ai_chat_id: aiChatId,
				// The letter only moves when the delete took the version it was
				// showing; a deliberate pick further back stands.
				...(rewind ? { content: liveContent, date_updated: new Date() } : {})
			})
			.where(eq(application_letters.id, letterId));

		return { success: true };
	},

	delete: async ({ locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const letterId = parseInt(params.letterId);
		if (isNaN(letterId)) return fail(400, { error: 'Invalid letter ID' });

		const existing = await db.query.applications.findFirst({
			where: and(eq(applications.id, appId), eq(applications.profile_id, profileId))
		});
		if (!existing) return fail(404, { error: 'Application not found' });

		const letter = await db.query.application_letters.findFirst({
			where: and(
				eq(application_letters.id, letterId),
				eq(application_letters.application_id, appId)
			)
		});
		if (!letter) return fail(404, { error: 'Letter not found' });

		await db.delete(application_letters).where(eq(application_letters.id, letterId));

		redirect(303, `/applications/${appId}/texts`);
	}
};
