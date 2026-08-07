import { json, type RequestHandler } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq, and, desc } from 'drizzle-orm';
import { profiles, cheat_sheets } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { touchProfile } from '$lib/server/profile/touch-profile';
import {
	cheatSheetCreateSchema,
	cheatSheetUpdateSchema,
	cheatSheetDeleteSchema,
	cheatSheetReorderSchema,
	parseBody
} from '$lib/server/validation/api-schemas';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);

	const { profile_id, title, content } = parseBody(cheatSheetCreateSchema, await request.json());

	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profile_id), eq(profiles.user_id, user.id))
	});

	if (!profile) {
		return json({ error: 'Profile not found' }, { status: 404 });
	}

	const lastItem = await db.query.cheat_sheets.findFirst({
		where: eq(cheat_sheets.profile_id, profile_id),
		orderBy: desc(cheat_sheets.sort)
	});

	const [sheet] = await db
		.insert(cheat_sheets)
		.values({
			title: title.trim(),
			content: content?.trim() || null,
			profile_id: profile_id,
			sort: (lastItem?.sort ?? -1) + 1,
			date_created: new Date()
		})
		.returning();

	await touchProfile(profile_id);

	return json({ success: true, sheet });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);

	const { profile_id, id, title, content } = parseBody(
		cheatSheetUpdateSchema,
		await request.json()
	);

	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profile_id), eq(profiles.user_id, user.id))
	});

	if (!profile) {
		return json({ error: 'Profile not found' }, { status: 404 });
	}

	const existing = await db.query.cheat_sheets.findFirst({
		where: and(eq(cheat_sheets.id, id), eq(cheat_sheets.profile_id, profile_id))
	});

	if (!existing) {
		return json({ error: 'Cheat sheet not found' }, { status: 404 });
	}

	const [sheet] = await db
		.update(cheat_sheets)
		.set({
			title: title.trim(),
			content: content?.trim() || null,
			date_updated: new Date()
		})
		.where(eq(cheat_sheets.id, id))
		.returning();

	await touchProfile(profile_id);

	return json({ success: true, sheet });
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);

	const { profile_id, order } = parseBody(cheatSheetReorderSchema, await request.json());

	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profile_id), eq(profiles.user_id, user.id))
	});

	if (!profile) {
		return json({ error: 'Profile not found' }, { status: 404 });
	}

	await Promise.all(
		order.map((id, index) =>
			db
				.update(cheat_sheets)
				.set({ sort: index, date_updated: new Date() })
				.where(and(eq(cheat_sheets.id, id), eq(cheat_sheets.profile_id, profile_id)))
		)
	);

	await touchProfile(profile_id);

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals);

	const { profile_id, id } = parseBody(cheatSheetDeleteSchema, await request.json());

	const profile = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, profile_id), eq(profiles.user_id, user.id))
	});

	if (!profile) {
		return json({ error: 'Profile not found' }, { status: 404 });
	}

	const existing = await db.query.cheat_sheets.findFirst({
		where: and(eq(cheat_sheets.id, id), eq(cheat_sheets.profile_id, profile_id))
	});

	if (!existing) {
		return json({ error: 'Cheat sheet not found' }, { status: 404 });
	}

	await db.delete(cheat_sheets).where(eq(cheat_sheets.id, id));

	await touchProfile(profile_id);

	return json({ success: true });
};
