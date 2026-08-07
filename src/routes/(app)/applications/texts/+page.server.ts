import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq, desc, asc } from 'drizzle-orm';
import {
	applications as applicationsTable,
	application_letters,
	application_questions
} from '$lib/server/db/schema';
import { getSelectedProfileId } from '../../profile/utils';

export const load: PageServerLoad = async ({ parent, url }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}

	const type = url.searchParams.get('type') || 'all';

	// Get all applications for this profile
	const apps = await db.query.applications.findMany({
		where: eq(applicationsTable.profile_id, layoutData.selectedProfile.id),
		with: {
			job: true,
			application_letters: {
				orderBy: desc(application_letters.date_created)
			},
			application_questions: {
				orderBy: asc(application_questions.sort)
			}
		},
		orderBy: desc(applicationsTable.date_updated)
	});

	// Flatten letters and questions with application context
	const letters = apps.flatMap((app) =>
		app.application_letters.map((letter) => ({
			...letter,
			application: app,
			itemType: 'letter' as const
		}))
	);

	const questions = apps.flatMap((app) =>
		app.application_questions.map((question) => ({
			...question,
			application: app,
			itemType: 'question' as const
		}))
	);

	// Filter by type
	let items: typeof letters | typeof questions | ((typeof letters)[0] | (typeof questions)[0])[] =
		[];
	if (type === 'letters') {
		items = letters;
	} else if (type === 'questions') {
		items = questions;
	} else {
		items = [...letters, ...questions].sort((a, b) => {
			const dateA = a.date_updated || a.date_created || new Date(0);
			const dateB = b.date_updated || b.date_created || new Date(0);
			return new Date(dateB).getTime() - new Date(dateA).getTime();
		});
	}

	return {
		items,
		currentType: type,
		profileId: layoutData.selectedProfile.id
	};
};

export const actions: Actions = {
	updateLetter: async ({ request, locals, cookies }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) {
			return fail(400, { error: 'No profile selected' });
		}

		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		const content = formData.get('content') as string;
		const status = formData.get('status') as string;

		if (isNaN(id)) {
			return fail(400, { error: 'Invalid letter ID' });
		}

		// Verify ownership through application
		const letter = await db.query.application_letters.findFirst({
			where: eq(application_letters.id, id),
			with: {
				application: true
			}
		});

		if (!letter || letter.application.profile_id !== profileId) {
			return fail(404, { error: 'Letter not found' });
		}

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

	updateQuestion: async ({ request, locals, cookies }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) {
			return fail(400, { error: 'No profile selected' });
		}

		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		const answer = formData.get('answer') as string;

		if (isNaN(id)) {
			return fail(400, { error: 'Invalid question ID' });
		}

		// Verify ownership through application
		const question = await db.query.application_questions.findFirst({
			where: eq(application_questions.id, id),
			with: {
				application: true
			}
		});

		if (!question || question.application.profile_id !== profileId) {
			return fail(404, { error: 'Question not found' });
		}

		await db
			.update(application_questions)
			.set({
				answer: answer || null,
				date_updated: new Date()
			})
			.where(eq(application_questions.id, id));

		return { success: true };
	},

	deleteLetter: async ({ request, locals, cookies }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) {
			return fail(400, { error: 'No profile selected' });
		}

		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);

		if (isNaN(id)) {
			return fail(400, { error: 'Invalid letter ID' });
		}

		const letter = await db.query.application_letters.findFirst({
			where: eq(application_letters.id, id),
			with: {
				application: true
			}
		});

		if (!letter || letter.application.profile_id !== profileId) {
			return fail(404, { error: 'Letter not found' });
		}

		await db.delete(application_letters).where(eq(application_letters.id, id));

		return { success: true };
	},

	deleteQuestion: async ({ request, locals, cookies }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) {
			return fail(400, { error: 'No profile selected' });
		}

		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);

		if (isNaN(id)) {
			return fail(400, { error: 'Invalid question ID' });
		}

		const question = await db.query.application_questions.findFirst({
			where: eq(application_questions.id, id),
			with: {
				application: true
			}
		});

		if (!question || question.application.profile_id !== profileId) {
			return fail(404, { error: 'Question not found' });
		}

		await db.delete(application_questions).where(eq(application_questions.id, id));

		return { success: true };
	}
};
