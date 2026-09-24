/**
 * What each caller ranks its evidence against: the RelevanceQuery for a cover
 * letter, an application answer and an assistant message.
 *
 * Each used to be built inline at its call site, and the choices in them are
 * deliberate (see the callers: an answer leaves the job description out, the
 * assistant adds the page's job title). They live here so the project-retrieval
 * golden set (cloud/scripts/golden/project-retrieval) builds its queries with
 * the code the callers run, and can tell when that code has changed under a
 * snapshot taken with the old one. Pure.
 */
import type { RelevanceQuery } from './generation-context';

interface QueryJob {
	title?: string | null;
	job_description?: string | null;
	/** The untyped jobs.skills_required json column, passed as it comes. */
	skills_required?: unknown;
}

const skillsOf = (job: QueryJob | null | undefined): string[] | undefined =>
	(job?.skills_required as string[] | null | undefined) ?? undefined;

/** A cover letter (or cheat-sheet letter) draft: ranked against the whole job. */
export function letterQuery(job: QueryJob): RelevanceQuery {
	return {
		text: [job.title, job.job_description].filter(Boolean).join('\n'),
		skills: skillsOf(job)
	};
}

/**
 * An application answer: the QUESTION leads, with the role title and required
 * skills as context. The job description is left out on purpose — its length
 * swamps a one-line question, so every question on an application would rank
 * the same job-driven set.
 */
export function applicationQuestionQuery(
	question: string,
	job: QueryJob | null | undefined
): RelevanceQuery {
	return {
		text: [question, job?.title].filter(Boolean).join('\n'),
		skills: skillsOf(job)
	};
}

/**
 * An assistant message: the message plus, on a job or application page, that
 * job's title and required skills (entityQueryJob in chat-context.ts).
 */
export function chatQuery(
	message: string,
	pageJob: { title?: string | null; skills_required?: unknown } | null | undefined
): RelevanceQuery {
	return {
		text: [message, pageJob?.title ?? ''].filter(Boolean).join('\n'),
		skills: skillsOf(pageJob)
	};
}
