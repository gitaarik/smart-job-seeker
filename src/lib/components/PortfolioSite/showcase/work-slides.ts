/**
 * The featured projects as the showcase's Selected work shows them: one slide
 * each, a teaser on the slide and the whole write-up in the story under the
 * carousel (SelectedWorkCarousel.svelte).
 *
 * Kept apart from the markup so what a slide holds is testable without a
 * browser, and so a role project and a side project, which hold different
 * fields, read the same once they are slides.
 */

import { formatDateRangeVerbose } from '$lib/tools/date-utils';
import { getWorkExperienceLogoUrl } from '$lib/utils/entity-media-url';
import type { FeaturedProject, Row, SiteLists } from '../site-lists';

/** How many technologies a slide names before "+N"; the story names them all. */
export const SLIDE_TECHNOLOGIES = 6;

export interface WorkSlide {
	key: string;
	/** Where the work was done: the employer, or the layout's word for a side project. */
	context: string;
	/** The employer's logo, for a role project whose role has one. */
	logo: string | null;
	name: string;
	/** A link the applicant typed in, so render it through ExternalLink. */
	link: string | null;
	/** Their part in it ("Solo engineer"), if they said. */
	role: string | null;
	period: string | null;
	/** The write-up, one entry per paragraph: a role project's description, a side project's summary. */
	story: string[];
	/** A role project's outcome, per paragraph. */
	outcome: string[];
	/** A side project's highlights. */
	points: string[];
	technologies: string[];
}

/** Paragraphs as the applicant typed them: split on blank lines. */
export function paragraphs(text: unknown): string[] {
	if (typeof text !== 'string') return [];
	return text
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean);
}

/**
 * Whether a slide has a story to open. The teaser clips its text to a few
 * lines, and how much that hides depends on the width it is read at, so any
 * write-up at all gets one; a project that is only a name and a stack has a
 * story only when the slide cannot name its whole stack.
 */
export function hasStory(slide: WorkSlide): boolean {
	return (
		slide.story.length + slide.outcome.length + slide.points.length > 0 ||
		slide.technologies.length > SLIDE_TECHNOLOGIES
	);
}

/**
 * One slide per featured project, in the order Selected work lists them.
 * `work` is the site's roles, for a role project's logo; `sideLabel` is what a
 * side project says where a role project names its employer.
 */
export function workSlides(
	items: FeaturedProject[],
	show: SiteLists['show'],
	work: Row[],
	sideLabel: string
): WorkSlide[] {
	return items.map(({ kind, project: p }) => {
		const role = kind === 'role' ? work.find((w) => w.id === p.roleId) : undefined;
		const technologies = show(
			(kind === 'role' ? p.work_experience_project_technologies : p.side_project_technologies) as
				Row[] | undefined
		)
			.map((t) => t.name)
			.filter((name): name is string => typeof name === 'string' && name.trim() !== '');
		return {
			key: `${kind}-${p.id}`,
			context: kind === 'role' ? String(p.company ?? '') : sideLabel,
			logo: role ? getWorkExperienceLogoUrl(role) : null,
			name: String(p.name ?? ''),
			link: p.url || (kind === 'side' ? p.repo_url : null) || null,
			role: p.project_role || null,
			period: p.start_date ? formatDateRangeVerbose(p.start_date, p.end_date) : null,
			story: paragraphs(kind === 'role' ? p.description : p.summary),
			outcome: kind === 'role' ? paragraphs(p.outcome) : [],
			points:
				kind === 'side'
					? ((p.side_project_achievements ?? []) as Row[])
							.map((a) => a.description)
							.filter((d): d is string => typeof d === 'string' && d.trim() !== '')
					: [],
			technologies
		};
	});
}
