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

import { siteLists, type Row } from '$lib/components/PortfolioSite/site-lists';

/** Highlights the public page prints: the two lists beside the About me. */
const HOME_HIGHLIGHT_TYPES = new Set(['key_skill', 'contact_for']);

/** Role columns a featured project needs from its role on the public page. */
const ROLE_COLUMNS = ['id', 'name', 'sort', 'tags', 'logo_id', 'logo_path'] as const;

/**
 * The page tree for the public page of a site whose career has a page of its
 * own: the introduction, the quotes and the featured projects, and nothing
 * else of the career.
 *
 * A featured project keeps its whole row, since the public page prints it in
 * full. Its role keeps only what that needs (its name and logo) and what the
 * site's filter reads (id and tags), so the page decides what shows exactly as
 * it would have from the whole tree; the role's achievements, technologies,
 * summary and other projects stay on the server. Takes the tree `pageProfile`
 * returned, after the overlays, and `versionId` is the version it renders.
 */
export function homePageProfile<T extends Row>(page: T, versionId: number | null): T {
	const { featured } = siteLists(page, versionId);
	const roleProjects = new Set(featured.filter((f) => f.kind === 'role').map((f) => f.project.id));
	const sideProjects = new Set(featured.filter((f) => f.kind === 'side').map((f) => f.project.id));

	const roles = ((page.work_experiences ?? []) as Row[])
		.map((role) => {
			const kept: Row = Object.fromEntries(ROLE_COLUMNS.map((column) => [column, role[column]]));
			kept.work_experience_projects = ((role.work_experience_projects ?? []) as Row[]).filter(
				(project) => roleProjects.has(project.id)
			);
			return kept;
		})
		.filter((role) => role.work_experience_projects.length > 0);

	return {
		...page,
		summary: null,
		work_experiences: roles,
		side_projects: ((page.side_projects ?? []) as Row[]).filter((p) => sideProjects.has(p.id)),
		highlights: ((page.highlights ?? []) as Row[]).filter((h) => HOME_HIGHLIGHT_TYPES.has(h.type)),
		tech_skill_categories: [],
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
