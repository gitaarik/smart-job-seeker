/**
 * What a portfolio site prints, whichever layout prints it.
 *
 * Both layouts read the profile through this, so a version's tags and an
 * entry's Site switch (`!portfolio`) decide the same things on either; a
 * second copy of the filtering in the showcase would be a second answer to
 * "is this on my site". See PortfolioSite.svelte for why the site is its own
 * base type beside `resume` and `cv`.
 */

import { createProfileFilter } from '$lib/components/ProfileDisplay/profile-filter';
import {
	careerDetail,
	themeSections,
	type CareerDetail,
	type PortfolioPage,
	type PortfolioThemeConfig
} from '$lib/portfolio-themes';

// One loose row type for the whole tree, for the reason PortfolioSite gives:
// the include's inferred type is enormous, and spreading a `Record<string,
// unknown>` drops its index signature.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export interface SiteLists {
	/** The filter for nested lists the markup reaches itself (a role's technologies). */
	show: <T extends Row>(list: T[] | undefined, entity?: string) => T[];
	work: Row[];
	/** Every role's projects in role order, each with its company's name as `company`. */
	roleProjects: Row[];
	sideProjects: Row[];
	/** Categories with their shown skills, and only those that still have one. */
	skillCategories: Row[];
	educations: Row[];
	certificates: Row[];
	languages: Row[];
	references: Row[];
	/**
	 * The `highlights` rows of kind `highlight`, and any from before rows had a
	 * kind: what a Highlights section prints.
	 *
	 * One table holds both lists the Highlights page keeps, and a row's `type`
	 * says which. Both layouts used to print every row as a highlight, so a
	 * classic site listed the showcase's Contact for lines, and the copy of an
	 * old Key skills box, between the highlights. A `key_skill` row is in
	 * neither list: the showcase builds that box from the Skills (key-skills.ts).
	 */
	highlights: Row[];
	/** The `contact_for` rows: the showcase's Contact for box, beside its About me. */
	contactFor: Row[];
	/**
	 * What the applicant featured. Only what is still on the site, so a
	 * featured entry switched off the site stays off it.
	 *
	 * Ordered by hand once the applicant has (`featured_sort`, set by the
	 * reorder on the portfolio settings page), and otherwise in the order the
	 * career reads: each role that is featured itself, then its featured
	 * projects, role by role, and the featured side projects after them. The
	 * two mix the way the profile lists' date and drag orders do: entries with
	 * a place come first by it, and one without (featured after the reorder)
	 * follows them in career order. Null everywhere is career order.
	 */
	featured: FeaturedWork[];
}

/**
 * One featured entry and what it is, since each holds different fields: a
 * role's project (`role`, with its employer's name as `company`), a side
 * project (`side`), or a role itself (`experience`), for work that is the role
 * rather than a project in it.
 */
export type FeaturedWork =
	| { kind: 'role'; project: Row }
	| { kind: 'side'; project: Row }
	| { kind: 'experience'; role: Row };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the profile tree, see Row
export function siteLists(profile: any, versionId: number | null): SiteLists {
	// 'portfolio' as the base type, beside 'resume' and 'cv'. A version's own
	// slug still selects, so a version built for the site filters as usual.
	const filter = createProfileFilter(profile.profile_versions, 'portfolio', versionId, '');

	const show = <T extends Row>(list: T[] | undefined, entity?: string): T[] =>
		list?.length ? filter.filterOnTags(list, entity) : [];

	const work = show(profile.work_experiences, 'work_experience');
	// A project's own Site switch, read the way a technology's is. No override
	// entity: tailoring decides nothing about a role project, so no version has
	// a per-job exception to make. `roleId` says whose it is, for `careerView`.
	const roleProjects = work.flatMap((w: Row) =>
		show((w.work_experience_projects ?? []) as Row[]).map((p) => ({
			...p,
			company: w.name,
			roleId: w.id
		}))
	);
	const sideProjects = show(profile.side_projects, 'side_project');
	const highlightRows = show(profile.highlights);
	return {
		show,
		work,
		roleProjects,
		sideProjects,
		skillCategories: show(profile.tech_skill_categories, 'skill_category')
			.map((c: Row) => ({ ...c, tech_skills: show((c.tech_skills ?? []) as Row[], 'skill') }))
			.filter((c: Row) => c.tech_skills.length > 0),
		educations: show(profile.educations, 'education'),
		certificates: show(profile.certificates),
		languages: show(profile.languages),
		references: show(profile.references),
		highlights: highlightRows.filter((h) => !h.type || h.type === 'highlight'),
		contactFor: highlightRows.filter((h) => h.type === 'contact_for'),
		featured: featuredWork(work, roleProjects, sideProjects)
	};
}

/**
 * The featured entries among these lists, in the order Selected work shows
 * them (see `SiteLists.featured`). `roleProjects` carry their `roleId` and
 * `company`, as `siteLists` builds them. The portfolio settings page passes
 * the unfiltered lists, so its reorder lists every featured entry; the order
 * of any two entries does not depend on what else is in the list, so the site
 * shows the same order less whatever it filters out.
 */
export function featuredWork(
	work: Row[],
	roleProjects: Row[],
	sideProjects: Row[]
): FeaturedWork[] {
	return handOrder([
		...work.flatMap((role: Row): FeaturedWork[] => [
			...(isFeatured(role) ? [{ kind: 'experience' as const, role }] : []),
			...roleProjects
				.filter((p) => p.roleId === role.id && isFeatured(p))
				.map((project) => ({ kind: 'role' as const, project }))
		]),
		...sideProjects.filter(isFeatured).map((project) => ({ kind: 'side' as const, project }))
	]);
}

const isFeatured = (entry: Row): boolean => entry.featured === true;

/** A featured entry's hand-picked place in Selected work, or null for none. */
export function featuredSort(item: FeaturedWork): number | null {
	const row = item.kind === 'experience' ? item.role : item.project;
	return typeof row.featured_sort === 'number' ? row.featured_sort : null;
}

/**
 * Career-ordered featured work put in the applicant's order: entries with a
 * place first, by it, then the rest as they came. The sort is stable, so ties
 * and the unplaced keep career order.
 */
function handOrder(career: FeaturedWork[]): FeaturedWork[] {
	return career
		.map((item, index) => ({ item, index, place: featuredSort(item) }))
		.sort((a, b) => {
			if (a.place !== null && b.place !== null) return a.place - b.place || a.index - b.index;
			if (a.place !== null) return -1;
			if (b.place !== null) return 1;
			return a.index - b.index;
		})
		.map(({ item }) => item);
}

/** A featured entry's key, unique across the three kinds (`role-10`, `experience-3`). */
export function featuredKey(item: FeaturedWork): string {
	return item.kind === 'experience'
		? `experience-${item.role.id}`
		: `${item.kind}-${item.project.id}`;
}

/**
 * Whether a role prints as one line: it ended more than `years` years before
 * `today`. A current role (no end date) never does.
 */
export function isBriefRole(
	role: Row,
	years: CareerDetail['briefRolesAfterYears'],
	today: Date
): boolean {
	if (years === 'never' || !role.end_date) return false;
	const ended = new Date(role.end_date);
	if (Number.isNaN(ended.getTime())) return false;
	const cutoff = new Date(today);
	cutoff.setFullYear(cutoff.getFullYear() - years);
	return ended < cutoff;
}

/**
 * A role's achievements, split into those printed and those behind a "show
 * more". The applicant's own order decides which come first. One left over is
 * printed rather than hidden: a disclosure for a single line costs the reader
 * more than the line.
 */
export function splitAchievements<T>(
	achievements: T[],
	perRole: CareerDetail['achievementsPerRole']
): { shown: T[]; more: T[] } {
	if (perRole === 'all' || achievements.length <= perRole + 1) {
		return { shown: achievements, more: [] };
	}
	return { shown: achievements.slice(0, perRole), more: achievements.slice(perRole) };
}

export interface CareerView {
	/** The theme's settings, defaults filled in. */
	detail: CareerDetail;
	/** Roles printed in full, in profile order. */
	fullRoles: Row[];
	/** Roles printed as one line each, under "Earlier roles". */
	briefRoles: Row[];
	/** Whether Selected work is on the page, which moves the featured projects there. */
	selectedWork: boolean;
	/** Role projects printed in full in the Projects section. */
	fullProjects: Row[];
	/** Role projects listed by name, their write-up behind a click. */
	briefProjects: Row[];
	fullSideProjects: Row[];
	briefSideProjects: Row[];
}

/**
 * What the career sections print in full and what they list briefly, the same
 * on either layout.
 *
 * Roles that ended longer ago than the theme's `briefRolesAfterYears` print as
 * a line. With Selected work on the page (the theme shows the section and
 * something is featured), every featured project is printed there and nowhere
 * else, and every other project is listed briefly: featuring is choosing what
 * to highlight, so the rest step back. A featured role is the exception that
 * stays where it is as well, because the career without it would have a gap;
 * Selected work only adds it up front, and it prints in full however long ago
 * it ended. Without Selected work, featuring changes nothing: projects print in
 * full as they always did, except those of a role that is itself printed as a
 * line, which would otherwise outweigh their role.
 *
 * The private CV page (`page: 'cv'`) has no Selected work, because the public
 * page shows it. A featured project prints in full in its own section there
 * instead, the rest still briefly, so the CV is whole and keeps the same
 * emphasis.
 */
export function careerView(
	lists: SiteLists,
	config: PortfolioThemeConfig,
	today: Date = new Date(),
	page: PortfolioPage = 'site'
): CareerView {
	const detail = careerDetail(config);
	const featuring = themeSections(config).includes('featured') && lists.featured.length > 0;
	const brief = new Set(
		lists.work
			.filter((role) => !(featuring && isFeatured(role)))
			.filter((role) => isBriefRole(role, detail.briefRolesAfterYears, today))
			.map((role) => role.id)
	);
	const selectedWork = featuring && page !== 'cv';
	const inPlace = featuring && page === 'cv';
	const notFeatured = (project: Row) => !isFeatured(project);

	return {
		detail,
		fullRoles: lists.work.filter((role) => !brief.has(role.id)),
		briefRoles: lists.work.filter((role) => brief.has(role.id)),
		selectedWork,
		fullProjects: selectedWork
			? []
			: inPlace
				? lists.roleProjects.filter(isFeatured)
				: lists.roleProjects.filter((p) => !brief.has(p.roleId)),
		briefProjects: featuring
			? lists.roleProjects.filter(notFeatured)
			: lists.roleProjects.filter((p) => brief.has(p.roleId)),
		fullSideProjects: selectedWork
			? []
			: inPlace
				? lists.sideProjects.filter(isFeatured)
				: lists.sideProjects,
		briefSideProjects: featuring ? lists.sideProjects.filter(notFeatured) : []
	};
}
