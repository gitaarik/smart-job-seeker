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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the profile tree, see Row
export function siteLists(profile: any, versionId: number | null): SiteLists {
	// 'portfolio' as the base type, beside 'resume' and 'cv'. A version's own
	// slug still selects, so a version built for the site filters as usual.
	const filter = createProfileFilter(profile.profile_versions, 'portfolio', versionId, '');

	const show = <T extends Row>(list: T[] | undefined, entity?: string): T[] =>
		list?.length ? filter.filterOnTags(list, entity) : [];

	const work = show(profile.work_experiences, 'work_experience');
	return {
		show,
		work,
		roleProjects: work.flatMap((w: Row) =>
			((w.work_experience_projects ?? []) as Row[]).map((p) => ({ ...p, company: w.name }))
		),
		sideProjects: show(profile.side_projects, 'side_project'),
		skillCategories: show(profile.tech_skill_categories, 'skill_category')
			.map((c: Row) => ({ ...c, tech_skills: show((c.tech_skills ?? []) as Row[], 'skill') }))
			.filter((c: Row) => c.tech_skills.length > 0),
		educations: show(profile.educations, 'education'),
		certificates: show(profile.certificates),
		languages: show(profile.languages),
		references: show(profile.references),
		highlights: show(profile.highlights)
	};
}
