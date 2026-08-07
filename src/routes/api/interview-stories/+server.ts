import { json, type RequestHandler } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq, and, desc } from 'drizzle-orm';
import { profiles, project_stories } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { touchProfile } from '$lib/server/profile/touch-profile';
import {
	interviewStoryCreateSchema,
	interviewStoryUpdateSchema,
	interviewStoryDeleteSchema,
	interviewStoryReorderSchema,
	parseBody
} from '$lib/server/validation/api-schemas';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);

	const { profile_id, title, category, situation, task, action, result, reflection } = parseBody(
		interviewStoryCreateSchema,
		await request.json()
	);

	// Verify the profile belongs to this user
	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profile_id), eq(profiles.user_id, user.id))
	});

	if (!profile) {
		return json({ error: 'Profile not found' }, { status: 404 });
	}

	// Get the highest sort value
	const lastItem = await db.query.project_stories.findFirst({
		where: eq(project_stories.profile_id, profile_id),
		orderBy: desc(project_stories.sort)
	});

	const [story] = await db
		.insert(project_stories)
		.values({
			title: title.trim(),
			category: category?.trim() || null,
			situation: situation?.trim() || null,
			task: task?.trim() || null,
			action: action?.trim() || null,
			result: result?.trim() || null,
			reflection: reflection?.trim() || null,
			profile_id: profile_id,
			sort: (lastItem?.sort ?? -1) + 1,
			date_created: new Date()
		})
		.returning();

	await touchProfile(profile_id);

	return json({ success: true, story });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);

	const { profile_id, id, title, category, situation, task, action, result, reflection } =
		parseBody(interviewStoryUpdateSchema, await request.json());

	// Verify the profile belongs to this user
	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profile_id), eq(profiles.user_id, user.id))
	});

	if (!profile) {
		return json({ error: 'Profile not found' }, { status: 404 });
	}

	// Verify the story belongs to this profile
	const existing = await db.query.project_stories.findFirst({
		where: and(eq(project_stories.id, id), eq(project_stories.profile_id, profile_id))
	});

	if (!existing) {
		return json({ error: 'Story not found' }, { status: 404 });
	}

	const [story] = await db
		.update(project_stories)
		.set({
			title: title.trim(),
			category: category?.trim() || null,
			situation: situation?.trim() || null,
			task: task?.trim() || null,
			action: action?.trim() || null,
			result: result?.trim() || null,
			reflection: reflection?.trim() || null,
			date_updated: new Date()
		})
		.where(eq(project_stories.id, id))
		.returning();

	await touchProfile(profile_id);

	return json({ success: true, story });
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);

	const { profile_id, order } = parseBody(interviewStoryReorderSchema, await request.json());

	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profile_id), eq(profiles.user_id, user.id))
	});

	if (!profile) {
		return json({ error: 'Profile not found' }, { status: 404 });
	}

	await Promise.all(
		order.map((id, index) =>
			db
				.update(project_stories)
				.set({ sort: index, date_updated: new Date() })
				.where(and(eq(project_stories.id, id), eq(project_stories.profile_id, profile_id)))
		)
	);

	await touchProfile(profile_id);

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);

	const { profile_id, id } = parseBody(interviewStoryDeleteSchema, await request.json());

	// Verify the profile belongs to this user
	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profile_id), eq(profiles.user_id, user.id))
	});

	if (!profile) {
		return json({ error: 'Profile not found' }, { status: 404 });
	}

	// Verify the story belongs to this profile
	const existing = await db.query.project_stories.findFirst({
		where: and(eq(project_stories.id, id), eq(project_stories.profile_id, profile_id))
	});

	if (!existing) {
		return json({ error: 'Story not found' }, { status: 404 });
	}

	await db.delete(project_stories).where(eq(project_stories.id, id));

	await touchProfile(profile_id);

	return json({ success: true });
};
