/**
 * "What are you looking for?": the one screen between creating a profile and
 * the dashboard.
 *
 * A new profile could not be matched on anything. A manual one has a name and
 * maybe a title; even a parsed CV leaves match preferences empty, and the
 * corpus picks (sjs-ops planning/CORPUS-MATCHING.md, Phase 2) wait for work
 * location and job types before a first batch is queued, as the matcher does.
 * Getting Started asked for these on two pages, in steps 1 and 2, and a new
 * user met neither until they went looking.
 *
 * This asks only what stage 1 and 2 of the picks read: a title, a handful of
 * skills, the work arrangement, job types, where, and the level. Everything is
 * written through the same doors the full pages use (the profile row, the
 * skills table, `writeMatchPreferences`), so the full pages show it as their
 * own. Skills are only added here, never removed: a parsed CV can bring sixty,
 * and this is not the screen to prune them on.
 */
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { and, asc, desc, eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { profiles, tech_skill_categories, tech_skills } from '$lib/server/db/schema';
import {
	EXPERIENCE_LEVEL_OPTIONS,
	JOB_TYPE_OPTIONS,
	WORK_LOCATION_OPTIONS,
	readMatchPreferences,
	writeMatchPreferences
} from '$lib/server/job/match-preferences';
import { touchProfile } from '../utils';
import { isThinProfile } from '$lib/server/profile/thin-profile';
import { placeSchema, preferredPlaceSchema } from '$lib/server/validation/api-schemas';

/** Category for skills added here when the profile has none to put them in. */
const NEW_CATEGORY_NAME = 'Skills';

/** The skill count the screen asks for; the matcher wants more, Getting Started says so after. */
const SUGGESTED_SKILLS = 5;

const oneOf = (options: string[]) => z.string().refine((v) => options.includes(v));

const schema = z.object({
	title: z.string().trim().min(1, 'Add the job title you are looking for').max(200),
	location: z.string().trim().max(200),
	skills: z.array(z.string().trim().min(1).max(80)).max(50),
	work_location: z.array(oneOf(WORK_LOCATION_OPTIONS)).min(1, 'Pick at least one work arrangement'),
	job_types: z.array(oneOf(JOB_TYPE_OPTIONS)).min(1, 'Pick at least one job type'),
	experience_levels: z.array(oneOf(EXPERIENCE_LEVEL_OPTIONS)),
	locations: z.array(z.string().trim().min(1).max(100)).max(20),
	place: placeSchema.nullable(),
	places: z.array(preferredPlaceSchema).max(20)
});

/** A hidden input's JSON, or `fallback` when it holds none or no JSON. */
function jsonField(value: FormDataEntryValue | null, fallback: unknown): unknown {
	if (typeof value !== 'string' || !value) return fallback;
	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
}

async function profileSkillNames(profileId: number): Promise<string[]> {
	const rows = await db
		.select({ name: tech_skills.name })
		.from(tech_skills)
		.innerJoin(tech_skill_categories, eq(tech_skills.category_id, tech_skill_categories.id))
		.where(eq(tech_skill_categories.profile_id, profileId));
	return rows.map((r) => r.name).filter((n): n is string => !!n?.trim());
}

export const load: PageServerLoad = async ({ parent, url }) => {
	const { selectedProfile } = await parent();
	if (!selectedProfile) redirect(303, '/profile/create');

	const profileId = selectedProfile.id;
	const [profile, skills, config, thin] = await Promise.all([
		db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			columns: { title: true, location: true, place: true }
		}),
		profileSkillNames(profileId),
		readMatchPreferences(profileId),
		isThinProfile(profileId)
	]);

	return {
		profileId,
		title: profile?.title ?? '',
		location: profile?.location ?? '',
		place: profile?.place ?? null,
		skills,
		// No roles: the CV import is offered first, since roles are what the
		// match scores read and this form cannot give them.
		thin,
		config: {
			work_location: config.work_location,
			job_types: config.job_types,
			experience_levels: config.experience_levels,
			locations: config.locations,
			places: config.places
		},
		// The picks run on the worker; the app reads the same env file, so the
		// promise below is only made where something will keep it.
		picksOn: config.corpus_picks_enabled && process.env.SJS_CORPUS_PICKS === 'on',
		options: {
			workLocation: WORK_LOCATION_OPTIONS,
			jobTypes: JOB_TYPE_OPTIONS,
			experienceLevels: EXPERIENCE_LEVEL_OPTIONS
		},
		suggestedSkills: SUGGESTED_SKILLS,
		// Passed on to the dashboard, whose banner and `profile_created` event
		// read it; creating a profile lands here first now.
		created: url.searchParams.get('created') === 'true'
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const form = await request.formData();
		const profileId = Number(form.get('profile_id'));
		const parsed = schema.safeParse({
			title: form.get('title') ?? '',
			location: form.get('location') ?? '',
			skills: form.getAll('skills'),
			work_location: form.getAll('work_location'),
			job_types: form.getAll('job_types'),
			experience_levels: form.getAll('experience_levels'),
			locations: form.getAll('locations'),
			place: jsonField(form.get('place'), null),
			places: jsonField(form.get('places'), [])
		});
		if (!parsed.success) {
			return fail(400, { error: parsed.error.issues[0]?.message ?? 'Check the form' });
		}
		const values = parsed.data;

		const owned = await db.query.profiles.findFirst({
			where: and(eq(profiles.id, profileId), eq(profiles.user_id, user.id)),
			columns: { id: true }
		});
		if (!owned) return fail(404, { error: 'Profile not found' });

		await db
			.update(profiles)
			.set({
				title: values.title,
				location: values.location || null,
				place: values.place,
				date_updated: new Date()
			})
			.where(eq(profiles.id, profileId));

		await addSkills(profileId, values.skills);

		await writeMatchPreferences(profileId, {
			work_location: values.work_location,
			job_types: values.job_types,
			experience_levels: values.experience_levels,
			locations: values.locations,
			places: values.places
		});
		await touchProfile(profileId);

		const created = form.get('created') === 'true' ? '&created=true' : '';
		redirect(303, `/home?profile=${profileId}${created}`);
	}
};

/** Add the names the profile does not have yet, at the end of its first category. */
async function addSkills(profileId: number, names: string[]): Promise<void> {
	const have = new Set((await profileSkillNames(profileId)).map((n) => n.toLowerCase()));
	const fresh: string[] = [];
	for (const name of names) {
		const key = name.toLowerCase();
		if (have.has(key)) continue;
		have.add(key);
		fresh.push(name);
	}
	if (!fresh.length) return;

	let category = await db.query.tech_skill_categories.findFirst({
		where: eq(tech_skill_categories.profile_id, profileId),
		orderBy: asc(tech_skill_categories.sort),
		columns: { id: true }
	});
	if (!category) {
		[category] = await db
			.insert(tech_skill_categories)
			.values({
				name: NEW_CATEGORY_NAME,
				profile_id: profileId,
				sort: 0,
				status: 'published',
				date_created: new Date()
			})
			.returning({ id: tech_skill_categories.id });
	}

	const last = await db.query.tech_skills.findFirst({
		where: eq(tech_skills.category_id, category.id),
		orderBy: desc(tech_skills.sort),
		columns: { sort: true }
	});
	const start = (last?.sort ?? -1) + 1;
	await db.insert(tech_skills).values(
		fresh.map((name, i) => ({
			name,
			category_id: category.id,
			sort: start + i,
			status: 'published',
			date_created: new Date()
		}))
	);
}
