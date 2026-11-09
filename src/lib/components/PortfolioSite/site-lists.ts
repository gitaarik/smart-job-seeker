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
	highlights: Row[];
	/**
	 * The projects the applicant featured, from both lists: role projects in
	 * role order, then side projects. Only those still on the site, so a
	 * featured project switched off the site stays off it.
	 */
	featured: FeaturedProject[];
}

/** A featured project and which list it came from, since the two hold different fields. */
export type FeaturedProject = { kind: 'role'; project: Row } | { kind: 'side'; project: Row };

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
		highlights: show(profile.highlights),
		featured: [
			...roleProjects.filter(isFeatured).map((project) => ({ kind: 'role' as const, project })),
			...sideProjects.filter(isFeatured).map((project) => ({ kind: 'side' as const, project }))
		]
	};
}

const isFeatured = (project: Row): boolean => project.featured === true;

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
 * to highlight, so the rest step back. Without it, projects print in full as
 * they always did, except those of a role that is itself printed as a line,
 * which would otherwise outweigh their role.
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
	const brief = new Set(
		lists.work
			.filter((role) => isBriefRole(role, detail.briefRolesAfterYears, today))
			.map((role) => role.id)
	);
	const featuring = themeSections(config).includes('featured') && lists.featured.length > 0;
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
