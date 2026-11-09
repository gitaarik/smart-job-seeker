/**
 * How an entry reads when the site lists it briefly: one line, with whatever
 * else it holds behind a click.
 *
 * Both layouts list the same things this way (see `careerView` in
 * site-lists.ts): a role old enough to print as a line, and, once some
 * projects are featured, every project that is not. Built here so the two
 * layouts cannot disagree about what a brief project still shows.
 */

import { formatDateRangeVerbose } from '$lib/tools/date-utils';
import type { Row, SiteLists } from './site-lists';

export interface BriefEntry {
	key: number;
	name: string;
	/** Printed after the name, each after a middot: where, and when. */
	meta: string[];
	/** Behind the click, in this order. An entry with none of them has no click. */
	paragraphs: string[];
	bullets: string[];
	technologies: string[];
	/** A link the applicant typed, so render it through ExternalLink. */
	link: string | null;
}

/** Whether a brief entry has anything behind its line. */
export function hasDetails(entry: BriefEntry): boolean {
	return (
		entry.paragraphs.length > 0 ||
		entry.bullets.length > 0 ||
		entry.technologies.length > 0 ||
		!!entry.link
	);
}

const texts = (...values: unknown[]): string[] =>
	values.filter((v): v is string => typeof v === 'string' && v.trim() !== '');

/**
 * A role printed as one line: its position, the employer and the dates.
 * Nothing behind a click: a role this old is in the career for its place in
 * the timeline, and its detail is the CV's to give.
 */
export function briefRole(role: Row): BriefEntry {
	return {
		key: role.id,
		name: role.position || role.name || '',
		meta: texts(
			role.position ? role.name : null,
			formatDateRangeVerbose(role.start_date, role.end_date)
		),
		paragraphs: [],
		bullets: [],
		technologies: [],
		link: null
	};
}

/** A role project listed by name, its write-up and stack behind the click. */
export function briefRoleProject(project: Row, show: SiteLists['show']): BriefEntry {
	return {
		key: project.id,
		name: project.name || '',
		meta: texts(
			project.company,
			project.project_role,
			formatDateRangeVerbose(project.start_date, project.end_date)
		),
		paragraphs: texts(project.description, project.outcome),
		bullets: [],
		technologies: texts(...show(project.work_experience_project_technologies).map((t) => t.name)),
		link: project.url || null
	};
}

/** A side project listed by name, its summary, highlights and stack behind the click. */
export function briefSideProject(project: Row, show: SiteLists['show']): BriefEntry {
	return {
		key: project.id,
		name: project.name || '',
		meta: texts(project.project_role, formatDateRangeVerbose(project.start_date, project.end_date)),
		paragraphs: texts(project.summary),
		bullets: texts(...(project.side_project_achievements ?? []).map((a: Row) => a.description)),
		technologies: texts(...show(project.side_project_technologies).map((t) => t.name)),
		link: project.url || project.repo_url || null
	};
}
