/**
 * The portfolio site as two pages: the public one, and the private CV page a
 * portfolio share link opens (`privateCv` in $lib/portfolio-themes.ts, the
 * key in portfolio-key.ts).
 *
 * Keeping the career off the public page is only half of keeping it private.
 * A SvelteKit page carries its load data in the HTML for hydration whether or
 * not its markup prints a field, which is how the page-data leak in
 * page-profile.ts happened. So the public page's tree is cut down here to what
 * that page renders, and the career reaches only the page behind the key.
 */

import { siteLists, type Row, type SiteLists } from '$lib/components/PortfolioSite/site-lists';
import { lineSkills } from '$lib/components/PortfolioSite/key-skills';

/**
 * Highlights the public page prints: the Contact for box beside the About me.
 * The Key skills box beside it reads the Skills (`keySkillGroups`).
 */
const HOME_HIGHLIGHT_TYPES = new Set(['contact_for']);

/** Role columns a featured project needs from its role on the public page. */
const ROLE_COLUMNS = ['id', 'name', 'sort', 'tags', 'logo_id', 'logo_path'] as const;

/**
 * What a featured role adds to those for its own slide (work-slides.ts
 * `roleSlide`): its title, dates and summary. Its achievements and
 * technologies come through `shownRows`.
 */
const FEATURED_ROLE_COLUMNS = [
	...ROLE_COLUMNS,
	'featured',
	'featured_sort',
	'position',
	'start_date',
	'end_date',
	'summary'
] as const;

const pick = (row: Row, columns: readonly string[]): Row =>
	Object.fromEntries(columns.map((column) => [column, row[column]]));

/**
 * A list under a featured entry as the site shows it: only the rows its filter
 * keeps, each cut to its text and what the filter reads (id and tags), so the
 * page decides the same from what is left. The slide prints only what the
 * filter keeps, but a row it drops would still be in the page's data, and a
 * row is switched off the site precisely to keep it off the public page.
 */
function shownRows(
	show: SiteLists['show'],
	rows: Row[] | undefined,
	entity: string | undefined,
	text: 'description' | 'name'
): Row[] {
	return show(rows, entity).map((row) => ({ id: row.id, [text]: row[text], tags: row.tags }));
}

/**
 * The Skills as far as the Key skills box reads them (key-skills.ts): each
 * group the site shows, with only the skills its line names. A group keeps its
 * icon and what the filter reads, a skill its name as well, and the group's
 * heading, the other skills and their levels stay on the server.
 */
function keySkillGroups(skillCategories: SiteLists['skillCategories']): Row[] {
	return skillCategories.map((group) => ({
		id: group.id,
		tags: group.tags,
		fa_icon: group.fa_icon,
		tech_skills: lineSkills(group).map((skill) => ({
			id: skill.id,
			name: skill.name,
			tags: skill.tags
		}))
	}));
}

/**
 * The page tree for the public page of a site whose career has a page of its
 * own: the introduction, the quotes, the featured work and the skills the Key
 * skills box names, and nothing else of the career.
 *
 * A featured project keeps its whole row, since the public page prints it in
 * full. Its role keeps only what that needs (its name and logo) and what the
 * site's filter reads (id and tags), so the page decides what shows exactly as
 * it would have from the whole tree; the role's achievements, technologies,
 * summary and other projects stay on the server. A featured role is printed
 * itself, so it keeps what its slide prints as well, and still none of the
 * projects nobody featured. Whatever a featured entry has switched off the
 * site (an achievement, a technology) stays on the server too. Takes the tree
 * `pageProfile` returned, after the overlays, and `versionId` is the version
 * it renders.
 */
export function homePageProfile<T extends Row>(page: T, versionId: number | null): T {
	const { featured, show, skillCategories } = siteLists(page, versionId);
	const roleProjects = new Set(featured.filter((f) => f.kind === 'role').map((f) => f.project.id));
	const sideProjects = new Set(featured.filter((f) => f.kind === 'side').map((f) => f.project.id));
	const featuredRoles = new Set(
		featured.flatMap((f) => (f.kind === 'experience' ? [f.role.id] : []))
	);

	const roles = ((page.work_experiences ?? []) as Row[])
		.map((role) => {
			const kept: Row = featuredRoles.has(role.id)
				? {
						...pick(role, FEATURED_ROLE_COLUMNS),
						work_experience_achievements: shownRows(
							show,
							role.work_experience_achievements,
							'achievement',
							'description'
						),
						work_experience_technologies: shownRows(
							show,
							role.work_experience_technologies,
							'technology',
							'name'
						)
					}
				: pick(role, ROLE_COLUMNS);
			kept.work_experience_projects = ((role.work_experience_projects ?? []) as Row[])
				.filter((project) => roleProjects.has(project.id))
				.map((project) => ({
					...project,
					work_experience_project_technologies: shownRows(
						show,
						project.work_experience_project_technologies,
						undefined,
						'name'
					)
				}));
			return kept;
		})
		.filter((role) => featuredRoles.has(role.id) || role.work_experience_projects.length > 0);

	return {
		...page,
		summary: null,
		work_experiences: roles,
		side_projects: ((page.side_projects ?? []) as Row[])
			.filter((p) => sideProjects.has(p.id))
			.map((p) => ({
				...p,
				side_project_technologies: shownRows(show, p.side_project_technologies, undefined, 'name')
			})),
		highlights: ((page.highlights ?? []) as Row[]).filter((h) => HOME_HIGHLIGHT_TYPES.has(h.type)),
		tech_skill_categories: keySkillGroups(skillCategories),
		educations: [],
		certificates: [],
		languages: []
	};
}

/**
 * The site's two pages as links, keeping what the visitor's own URL chose:
 * the language for everyone, and for the owner the theme and version they are
 * previewing, so moving between the pages does not drop the preview.
 */
export function portfolioHrefs(
	slug: string,
	url: URL,
	owner: boolean
): { home: string; cv: string } {
	const keep = new URLSearchParams();
	for (const name of owner ? ['lang', 'theme', 'version'] : ['lang']) {
		const value = url.searchParams.get(name);
		if (value) keep.set(name, value);
	}
	const query = keep.toString() ? `?${keep}` : '';
	const base = `/p/${encodeURIComponent(slug)}/portfolio`;
	return { home: `${base}${query}`, cv: `${base}/cv${query}` };
}
