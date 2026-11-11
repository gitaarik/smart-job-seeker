/**
 * The order of the portfolio site's Selected work, chosen by hand.
 *
 * Featured entries come from three tables (a role, a role's project, a side
 * project), so their order is a `featured_sort` on each row rather than a list
 * in the theme config: a theme is seeded across instances where the ids
 * differ, and the order belongs to the entries the way `featured` does. Null
 * on every row is career order, the order the site always had; a reorder
 * numbers every featured entry, and an entry featured afterwards follows the
 * numbered ones in career order until the next reorder. See site-lists.ts,
 * which applies it, for the reading.
 *
 * Only the reorder on the portfolio settings page writes it, so the column is
 * in no section contract (resources.ts) and the assistant cannot touch it.
 */

import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { dbDirect as db } from '$lib/server/db';
import { side_projects, work_experience_projects, work_experiences } from '$lib/server/db/schema';
import {
	featuredKey,
	featuredSort,
	featuredWork,
	type FeaturedWork
} from '$lib/components/PortfolioSite/site-lists';

/** One featured entry as the reorder card lists it. */
export interface FeaturedOrderItem {
	/** `featuredKey`: `role-10`, `side-3`, `experience-5`. */
	key: string;
	/** What ReorderableList keys its rows by; the position, as keys are strings. */
	id: number;
	kind: FeaturedWork['kind'];
	/** The project's name, or the role's title. */
	title: string;
	/** The employer for a role or its project; nothing for a side project. */
	company: string | null;
}

export interface FeaturedOrder {
	items: FeaturedOrderItem[];
	/** `manual` once any featured entry has a place, as the profile lists say it. */
	ordering: 'date' | 'manual';
}

/**
 * Every featured entry of the profile, in the order Selected work shows them.
 *
 * Read without the site's filter: Selected work also depends on the published
 * version's tags, and an entry tagged for some versions only would otherwise
 * be missing here and never get a place. The ordering is `featuredWork`'s, so
 * the site shows this order less whatever its version leaves out.
 */
export async function loadFeaturedOrder(profileId: number): Promise<FeaturedOrder> {
	const [roles, sides] = await Promise.all([
		db.query.work_experiences.findMany({
			where: eq(work_experiences.profile_id, profileId),
			columns: {
				id: true,
				name: true,
				position: true,
				featured: true,
				featured_sort: true
			},
			with: {
				work_experience_projects: {
					columns: { id: true, name: true, featured: true, featured_sort: true },
					orderBy: asc(work_experience_projects.sort)
				}
			},
			// The order the site reads roles in (PROFILE_INCLUDE's WORK_ORDER).
			orderBy: [asc(work_experiences.sort), desc(work_experiences.start_date)]
		}),
		db.query.side_projects.findMany({
			where: eq(side_projects.profile_id, profileId),
			columns: { id: true, name: true, featured: true, featured_sort: true },
			orderBy: [asc(side_projects.sort), desc(side_projects.start_date)]
		})
	]);

	const featured = featuredWork(
		roles,
		roles.flatMap((role) =>
			role.work_experience_projects.map((p) => ({ ...p, company: role.name, roleId: role.id }))
		),
		sides
	);
	return {
		items: featured.map((item, index) => ({
			key: featuredKey(item),
			id: index,
			kind: item.kind,
			title:
				(item.kind === 'experience' ? item.role.position || item.role.name : item.project.name) ||
				'Untitled',
			company:
				item.kind === 'experience'
					? item.role.name
					: item.kind === 'role'
						? item.project.company
						: null
		})),
		ordering: featured.some((item) => featuredSort(item) !== null) ? 'manual' : 'date'
	};
}

/** The rows a reorder numbers, by table: each id with its place. */
export interface FeaturedOrderPlan {
	roles: Array<{ id: number; place: number }>;
	roleProjects: Array<{ id: number; place: number }>;
	sideProjects: Array<{ id: number; place: number }>;
}

/**
 * The posted order as places per table, or null when it is not an order.
 *
 * Only keys of the profile's featured entries (`featured`, from
 * `loadFeaturedOrder`) are kept: a key for anything else, someone else's row
 * or one no longer featured, is dropped rather than written, and so is a
 * repeat. Places count the kept keys, so they stay 0, 1, 2 without gaps.
 */
export function planFeaturedOrder(
	raw: unknown,
	featured: ReadonlyArray<Pick<FeaturedOrderItem, 'key'>>
): FeaturedOrderPlan | null {
	if (!Array.isArray(raw) || !raw.every((key) => typeof key === 'string')) return null;
	const known = new Set(featured.map((item) => item.key));
	const seen = new Set<string>();
	const plan: FeaturedOrderPlan = { roles: [], roleProjects: [], sideProjects: [] };
	for (const key of raw as string[]) {
		if (!known.has(key) || seen.has(key)) continue;
		seen.add(key);
		const match = /^(experience|role|side)-(\d+)$/.exec(key);
		if (!match) continue;
		const entry = { id: Number(match[2]), place: seen.size - 1 };
		if (match[1] === 'experience') plan.roles.push(entry);
		else if (match[1] === 'role') plan.roleProjects.push(entry);
		else plan.sideProjects.push(entry);
	}
	return plan;
}

/** The profile's roles, for scoping the role projects, which have no profile_id. */
const rolesOf = (profileId: number) =>
	db
		.select({ id: work_experiences.id })
		.from(work_experiences)
		.where(eq(work_experiences.profile_id, profileId));

/** `CASE id WHEN … THEN place … END`, so each table takes one statement. */
function places(column: AnyPgColumn, entries: FeaturedOrderPlan['roles']) {
	return sql`CASE ${column} ${sql.join(
		entries.map((e) => sql`WHEN ${e.id} THEN ${e.place}::integer`),
		sql` `
	)} END`;
}

/**
 * Put the profile's Selected work in this order. Every write is held to the
 * profile's own rows that are featured, whatever ids the plan names, and a
 * place left on a row that is no longer featured is cleared, so featuring it
 * again starts it after the ordered ones rather than in its old spot.
 */
export async function saveFeaturedOrder(profileId: number, plan: FeaturedOrderPlan): Promise<void> {
	await db.transaction(async (tx) => {
		await resetIn(tx, profileId);
		if (plan.roles.length) {
			await tx
				.update(work_experiences)
				.set({ featured_sort: places(work_experiences.id, plan.roles) })
				.where(
					and(
						eq(work_experiences.profile_id, profileId),
						eq(work_experiences.featured, true),
						inArray(
							work_experiences.id,
							plan.roles.map((e) => e.id)
						)
					)
				);
		}
		if (plan.roleProjects.length) {
			await tx
				.update(work_experience_projects)
				.set({
					featured_sort: places(work_experience_projects.id, plan.roleProjects)
				})
				.where(
					and(
						inArray(work_experience_projects.work_experience_id, rolesOf(profileId)),
						eq(work_experience_projects.featured, true),
						inArray(
							work_experience_projects.id,
							plan.roleProjects.map((e) => e.id)
						)
					)
				);
		}
		if (plan.sideProjects.length) {
			await tx
				.update(side_projects)
				.set({ featured_sort: places(side_projects.id, plan.sideProjects) })
				.where(
					and(
						eq(side_projects.profile_id, profileId),
						eq(side_projects.featured, true),
						inArray(
							side_projects.id,
							plan.sideProjects.map((e) => e.id)
						)
					)
				);
		}
	});
}

/** Back to career order: every place on the profile's rows cleared. */
export async function resetFeaturedOrder(profileId: number): Promise<void> {
	await db.transaction((tx) => resetIn(tx, profileId));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function resetIn(tx: Tx, profileId: number): Promise<void> {
	await tx
		.update(work_experiences)
		.set({ featured_sort: null })
		.where(
			and(eq(work_experiences.profile_id, profileId), isNotNull(work_experiences.featured_sort))
		);
	await tx
		.update(work_experience_projects)
		.set({ featured_sort: null })
		.where(
			and(
				inArray(work_experience_projects.work_experience_id, rolesOf(profileId)),
				isNotNull(work_experience_projects.featured_sort)
			)
		);
	await tx
		.update(side_projects)
		.set({ featured_sort: null })
		.where(and(eq(side_projects.profile_id, profileId), isNotNull(side_projects.featured_sort)));
}
