import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import { applications, application_letters, application_questions } from '$lib/server/db/schema';
import { compareTexts, parseTextKey, placeInOrder, textKey } from '$lib/texts/text-order';
import { getSelectedProfileId } from '../../../profile/utils';

export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	createQuestion: async ({ request, locals, cookies, params }) => {
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
		const question = formData.get('question') as string;
		const answer = (formData.get('answer') as string | null)?.trim() || null;

		if (!question?.trim()) {
			return fail(400, { error: 'Question text is required' });
		}

		// No `sort`: a new text goes in date order, on top. See $lib/texts/text-order.ts.
		const [created] = await db
			.insert(application_questions)
			.values({
				application_id: appId,
				question: question.trim(),
				answer,
				date_created: new Date()
			})
			.returning({ id: application_questions.id });

		// Return the new id so the client can chain an AI action (e.g. review)
		// without a round-trip to look it up.
		return { success: true, questionId: created.id };
	},

	createQuestions: async ({ request, locals, cookies, params }) => {
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
		const raw = formData.get('questions') as string;

		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return fail(400, { error: 'Invalid questions payload' });
		}
		if (!Array.isArray(parsed)) {
			return fail(400, { error: 'Invalid questions payload' });
		}

		const entries = parsed.map((e) => ({
			question:
				typeof (e as { question?: unknown })?.question === 'string'
					? (e as { question: string }).question.trim()
					: '',
			answer:
				typeof (e as { answer?: unknown })?.answer === 'string'
					? (e as { answer: string }).answer.trim()
					: ''
		}));

		// Rows to insert. Drop fully-empty rows, but reject the whole batch if any
		// row has an answer without a question — `question` is NOT NULL and we
		// won't silently discard the user's text. The preview UI enforces this too.
		const nonEmpty = entries.filter((e) => e.question || e.answer);
		if (nonEmpty.some((e) => !e.question)) {
			return fail(400, {
				error: 'Every answer needs a question before saving'
			});
		}

		// Optional "fills": answers to write into existing questions the paste
		// flow recognized as exact duplicates. Each targets an existing question
		// id on THIS application; anything else is rejected (no cross-application
		// or fabricated-id writes).
		const fillsRaw = formData.get('fills');
		let fills: { id: number; answer: string }[] = [];
		if (typeof fillsRaw === 'string' && fillsRaw.trim()) {
			let parsedFills: unknown;
			try {
				parsedFills = JSON.parse(fillsRaw);
			} catch {
				return fail(400, { error: 'Invalid fills payload' });
			}
			if (!Array.isArray(parsedFills)) {
				return fail(400, { error: 'Invalid fills payload' });
			}
			fills = parsedFills
				.map((f) => ({
					id: Number((f as { id?: unknown })?.id),
					answer:
						typeof (f as { answer?: unknown })?.answer === 'string'
							? (f as { answer: string }).answer.trim()
							: ''
				}))
				.filter((f) => Number.isInteger(f.id) && f.answer);
		}

		if (nonEmpty.length === 0 && fills.length === 0) {
			return fail(400, { error: 'Nothing to save' });
		}

		// Fills must reference questions that actually belong to this application.
		if (fills.length > 0) {
			const appQuestions = await db.query.application_questions.findMany({
				where: eq(application_questions.application_id, appId),
				columns: { id: true }
			});
			const validIds = new Set(appQuestions.map((q) => q.id));
			if (fills.some((f) => !validIds.has(f.id))) {
				return fail(400, { error: 'Invalid question to update' });
			}
		}

		const now = new Date();

		// One statement and one timestamp, so the set keeps its pasted order: the
		// ids are handed out in row order and break the tie between them.
		if (nonEmpty.length > 0) {
			await db.insert(application_questions).values(
				nonEmpty.map((e) => ({
					application_id: appId,
					question: e.question,
					answer: e.answer || null,
					date_created: now
				}))
			);
		}

		for (const f of fills) {
			await db
				.update(application_questions)
				.set({
					answer: f.answer,
					date_updated: now
				})
				.where(eq(application_questions.id, f.id));
		}

		return { success: true, added: nonEmpty.length, filled: fills.length };
	},

	updateLetter: async ({ request, locals, cookies, params }) => {
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
		const id = parseInt(formData.get('id') as string);
		const content = formData.get('content') as string;
		const status = formData.get('status') as string;

		if (isNaN(id)) return fail(400, { error: 'Invalid letter ID' });

		const letter = await db.query.application_letters.findFirst({
			where: and(eq(application_letters.id, id), eq(application_letters.application_id, appId))
		});
		if (!letter) return fail(404, { error: 'Letter not found' });

		await db
			.update(application_letters)
			.set({
				content: content || null,
				status: status || 'draft',
				date_updated: new Date()
			})
			.where(eq(application_letters.id, id));

		return { success: true };
	},

	updateQuestion: async ({ request, locals, cookies, params }) => {
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
		const id = parseInt(formData.get('id') as string);
		const answer = formData.get('answer') as string;

		if (isNaN(id)) return fail(400, { error: 'Invalid question ID' });

		const question = await db.query.application_questions.findFirst({
			where: and(eq(application_questions.id, id), eq(application_questions.application_id, appId))
		});
		if (!question) return fail(404, { error: 'Question not found' });

		await db
			.update(application_questions)
			.set({
				answer: answer || null,
				date_updated: new Date()
			})
			.where(eq(application_questions.id, id));

		return { success: true };
	},

	deleteLetter: async ({ request, locals, cookies, params }) => {
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
		const id = parseInt(formData.get('id') as string);
		if (isNaN(id)) return fail(400, { error: 'Invalid letter ID' });

		const letter = await db.query.application_letters.findFirst({
			where: and(eq(application_letters.id, id), eq(application_letters.application_id, appId))
		});
		if (!letter) return fail(404, { error: 'Letter not found' });

		await db.delete(application_letters).where(eq(application_letters.id, id));

		return { success: true };
	},

	deleteQuestion: async ({ request, locals, cookies, params }) => {
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
		const id = parseInt(formData.get('id') as string);
		if (isNaN(id)) return fail(400, { error: 'Invalid question ID' });

		const question = await db.query.application_questions.findFirst({
			where: and(eq(application_questions.id, id), eq(application_questions.application_id, appId))
		});
		if (!question) return fail(404, { error: 'Question not found' });

		await db.delete(application_questions).where(eq(application_questions.id, id));

		return { success: true };
	},

	/**
	 * Put the texts in the order the applicant dragged them into.
	 *
	 * `order` is the dragged list's keys (`letter:12`, `question:34`). They take
	 * the places those texts held, and every other text keeps its own (see
	 * `placeInOrder`), then each text is written its index. Not `date_updated`:
	 * the list shows it as when the text was last edited, and moving it is not
	 * an edit.
	 */
	reorder: async ({ request, locals, cookies, params }) => {
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
		let order: unknown;
		try {
			order = JSON.parse(formData.get('order') as string);
		} catch {
			return fail(400, { error: 'Invalid order' });
		}
		if (!Array.isArray(order) || !order.every((key) => typeof key === 'string')) {
			return fail(400, { error: 'Invalid order' });
		}

		const columns = { id: true, sort: true, date_created: true } as const;
		const [letters, questions] = await Promise.all([
			db.query.application_letters.findMany({
				where: eq(application_letters.application_id, appId),
				columns
			}),
			db.query.application_questions.findMany({
				where: eq(application_questions.application_id, appId),
				columns
			})
		]);
		const current = [
			...letters.map((l) => ({ ...l, itemType: 'letter' as const })),
			...questions.map((q) => ({ ...q, itemType: 'question' as const }))
		]
			.sort(compareTexts)
			.map(textKey);

		const placed = placeInOrder(current, order);
		await db.transaction(async (tx) => {
			for (const [index, key] of placed.entries()) {
				const text = parseTextKey(key);
				if (!text) continue;
				const table = text.itemType === 'letter' ? application_letters : application_questions;
				await tx
					.update(table)
					.set({ sort: index })
					.where(and(eq(table.id, text.id), eq(table.application_id, appId)));
			}
		});

		return { success: true };
	},

	/** "Sort by date": drop the manual order, back to newest added first. */
	resetOrder: async ({ locals, cookies, params }) => {
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

		await db.transaction(async (tx) => {
			await tx
				.update(application_letters)
				.set({ sort: null })
				.where(eq(application_letters.application_id, appId));
			await tx
				.update(application_questions)
				.set({ sort: null })
				.where(eq(application_questions.application_id, appId));
		});

		return { success: true };
	}
};
