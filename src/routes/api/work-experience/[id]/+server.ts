import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, eq, notInArray } from 'drizzle-orm';
import {
	work_experience_achievements,
	work_experience_project_technologies,
	work_experience_projects,
	work_experience_technologies,
	work_experiences
} from '$lib/server/db/schema';
import { buildUpdateData, parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { touchProfile } from '$lib/server/profile/touch-profile';
import {
	parseBody,
	workExperienceAchievementsSchema,
	workExperienceBasicSchema,
	workExperienceProjectsSchema,
	workExperienceTechSchema
} from '$lib/server/validation/api-schemas';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const workExperienceId = parseIntParam(params.id, 'work experience');

	// Verify ownership through profile
	const workExperience = await db.query.work_experiences.findFirst({
		where: eq(work_experiences.id, workExperienceId),
		columns: {
			id: true,
			profile_id: true
		},
		with: {
			profile: {
				columns: { user_id: true }
			}
		}
	});

	if (!workExperience || workExperience.profile.user_id !== user.id) {
		error(403, 'Access denied');
	}

	const raw = await request.json();

	/**
	 * Every write here goes through this, so the parent row moves with its
	 * children.
	 *
	 * A role and its bullets live in their own tables, so editing them left
	 * `profiles.date_updated` untouched — and two things key off that: the
	 * matcher's `collected_data` staleness check, and the notice telling an
	 * applicant that their tailored document was decided before this edit. The
	 * work-experience LIST page has called touchProfile all along; this route,
	 * which is where a bullet is actually written, never did.
	 */
	const touched = async (result: Promise<Response>) => {
		const response = await result;
		await touchProfile(workExperience.profile_id);
		return response;
	};

	if (raw.section === 'technologies') {
		const data = parseBody(workExperienceTechSchema, raw);
		return touched(updateTechnologies(workExperienceId, data.technologies));
	} else if (raw.section === 'achievements') {
		const data = parseBody(workExperienceAchievementsSchema, raw);
		return touched(updateAchievements(workExperienceId, data.achievements));
	} else if (raw.section === 'projects') {
		const data = parseBody(workExperienceProjectsSchema, raw);
		return touched(updateProjects(workExperienceId, data.projects));
	}

	const data = parseBody(workExperienceBasicSchema, raw);
	return touched(updateBasicInfo(workExperienceId, data));
};

async function updateBasicInfo(id: number, data: Record<string, unknown>) {
	const updateData = buildUpdateData(
		data,
		[
			'name',
			'position',
			'location',
			'website',
			'headline',
			'summary',
			'start_date',
			'end_date',
			'tags'
		],
		{ start_date: 'date', end_date: 'date' }
	);

	await db.update(work_experiences).set(updateData).where(eq(work_experiences.id, id));

	return json({ success: true });
}

async function updateTechnologies(
	id: number,
	technologies: (string | { name: string; tags?: string[] | null })[]
) {
	await db
		.delete(work_experience_technologies)
		.where(eq(work_experience_technologies.work_experience_id, id));

	const now = new Date();
	const techData = technologies
		.map((tech, i) => {
			const name = (typeof tech === 'string' ? tech : tech.name)?.trim();
			const tags = typeof tech === 'string' ? null : (tech.tags ?? null);
			return { name, tags, sort: i };
		})
		.filter((t): t is { name: string; tags: string[] | null; sort: number } => !!t.name)
		.map((t) => ({
			name: t.name,
			work_experience_id: id,
			sort: t.sort,
			status: 'published',
			date_created: now,
			...(t.tags && t.tags.length > 0 ? { tags: t.tags } : {})
		}));

	if (techData.length > 0) {
		await db.insert(work_experience_technologies).values(techData);
	}

	return json({ success: true });
}

async function updateAchievements(
	id: number,
	achievements: { id?: number; description: string; tags?: string[] | null }[]
) {
	const now = new Date();
	const incoming = achievements.filter((a) => a.description?.trim());

	// Delete rows the client no longer has; keep everything it still references
	// by id so their ids stay stable (translations are keyed on them).
	const keepIds = incoming.map((a) => a.id).filter((x): x is number => Number.isInteger(x));
	await db
		.delete(work_experience_achievements)
		.where(
			keepIds.length > 0
				? and(
						eq(work_experience_achievements.work_experience_id, id),
						notInArray(work_experience_achievements.id, keepIds)
					)
				: eq(work_experience_achievements.work_experience_id, id)
		);

	// Update existing rows in place, insert new ones; return ids in order so the
	// client can adopt ids for freshly-added achievements.
	const result: { id: number }[] = [];
	for (let i = 0; i < incoming.length; i++) {
		const a = incoming[i];
		const description = a.description.trim();
		const tags = a.tags && a.tags.length > 0 ? a.tags : null;

		let row: { id: number } | undefined;
		if (Number.isInteger(a.id)) {
			[row] = await db
				.update(work_experience_achievements)
				.set({ description, tags, sort: i, date_updated: now })
				.where(
					and(
						eq(work_experience_achievements.id, a.id as number),
						eq(work_experience_achievements.work_experience_id, id)
					)
				)
				.returning({ id: work_experience_achievements.id });
		}
		// No id, or a stale id whose row is gone (e.g. deleted then undone) → insert.
		if (!row) {
			[row] = await db
				.insert(work_experience_achievements)
				.values({
					description,
					tags,
					work_experience_id: id,
					sort: i,
					status: 'published',
					date_created: now
				})
				.returning({ id: work_experience_achievements.id });
		}
		result.push({ id: row.id });
	}

	return json({ success: true, achievements: result });
}

type ProjectInput = {
	id?: number;
	name: string;
	url?: string | null;
	start_date?: string | null;
	end_date?: string | null;
	description?: string | null;
	outcome?: string | null;
	technologies?: string[];
};

async function updateProjects(workExperienceId: number, projects: ProjectInput[]) {
	const now = new Date();
	// A project needs a name to be worth keeping; drop nameless rows.
	const incoming = projects.filter((p) => p.name?.trim());

	// Delete rows the client no longer has; keep referenced ones by id so their
	// ids (and their technologies, via FK cascade) stay stable across saves.
	const keepIds = incoming.map((p) => p.id).filter((x): x is number => Number.isInteger(x));
	await db
		.delete(work_experience_projects)
		.where(
			keepIds.length > 0
				? and(
						eq(work_experience_projects.work_experience_id, workExperienceId),
						notInArray(work_experience_projects.id, keepIds)
					)
				: eq(work_experience_projects.work_experience_id, workExperienceId)
		);

	// `start_date`/`end_date` are date-only (string-mode) columns; pass the
	// "YYYY-MM-DD" string straight through, or null when cleared.
	const toDate = (v?: string | null) => (v?.trim() ? v.trim() : null);

	// Upsert each project in order (sort = index), then replace its technologies.
	// Return ids in order so the client can adopt them for freshly-added rows.
	const result: { id: number }[] = [];
	for (let i = 0; i < incoming.length; i++) {
		const p = incoming[i];
		const values = {
			name: p.name.trim(),
			url: p.url?.trim() || null,
			start_date: toDate(p.start_date),
			end_date: toDate(p.end_date),
			description: p.description?.trim() || null,
			outcome: p.outcome?.trim() || null,
			sort: i
		};

		let row: { id: number } | undefined;
		if (Number.isInteger(p.id)) {
			[row] = await db
				.update(work_experience_projects)
				.set({ ...values, date_updated: now })
				.where(
					and(
						eq(work_experience_projects.id, p.id as number),
						eq(work_experience_projects.work_experience_id, workExperienceId)
					)
				)
				.returning({ id: work_experience_projects.id });
		}
		// No id, or a stale id whose row is gone → insert.
		if (!row) {
			[row] = await db
				.insert(work_experience_projects)
				.values({
					...values,
					work_experience_id: workExperienceId,
					status: 'published',
					date_created: now
				})
				.returning({ id: work_experience_projects.id });
		}

		// Replace this project's technologies (delete-all + re-insert with sort).
		await db
			.delete(work_experience_project_technologies)
			.where(eq(work_experience_project_technologies.work_experience_project_id, row.id));
		const techData = (p.technologies ?? [])
			.map((name, j) => ({ name: name?.trim(), sort: j }))
			.filter((t): t is { name: string; sort: number } => !!t.name)
			.map((t) => ({
				name: t.name,
				work_experience_project_id: row!.id,
				sort: t.sort,
				date_created: now
			}));
		if (techData.length > 0) {
			await db.insert(work_experience_project_technologies).values(techData);
		}

		result.push({ id: row.id });
	}

	return json({ success: true, projects: result });
}
