/**
 * Shared job-description parser.
 *
 * Extracts structured job fields (title, company, location, salary, skills,
 * responsibilities, etc.) from raw job-posting text or HTML using the
 * `extract_job_data` LLM prompt. This is the reusable core that both the
 * scraper (`extractJobData`) and manual application-create flow call, so a
 * hand-entered job is enriched identically to a scraped one.
 *
 * The two inputs are prepared differently — a captured page is stripped of
 * its markup, a paste keeps its lines — see posting-text.ts for why that
 * distinction exists. The four header fields the model returns (title,
 * company, recruiter, location) then pass through extracted-header.ts, which
 * nulls what it cannot vouch for rather than storing something plausible; and
 * for a paste that still leaves one of them empty, header-recovery.ts asks
 * again, narrowly, keeping only what the posting can be shown to say.
 *
 * Keyed on `profileId` (not a scrape run), so it can run anywhere a profile
 * is known. Returns `null` on any failure — the LLM call, JSON parse, or a
 * missing profile — so callers can degrade (e.g. store the description
 * verbatim) rather than fail the whole operation.
 */

import { prepareJobTextForLlm } from './posting-text';
import { type ExtractedHeader, sanitizeExtractedHeader } from './extracted-header';
import { recoverPostingHeader } from './header-recovery';
import { runProfileAiChat } from '$lib/server/ai-chat/job-utils';
import { isValidJobPostingDate, parseRelativeDate } from '$lib/tools/date-utils';

/**
 * Optional hints about the job we expect to find, used to disambiguate pages
 * that show multiple job cards (the scraper passes these from the search page).
 */
export interface JobSearchContext {
	title?: string | null;
	company?: string | null;
	location?: string | null;
}

/**
 * Structured job fields extracted from a description. Mirrors the shape the
 * scraper consumes; all fields are best-effort and may be null.
 */
export interface ParsedJobDescription {
	title: string | null;
	/**
	 * A description of the work to offer as a title when the posting names no
	 * role — only from the header pass (`recoverHeader`), and only when `title`
	 * is still null after it. Never an extraction: the review form shows it
	 * marked as a suggestion, and no other caller stores it.
	 */
	suggested_title: string | null;
	job_description: string | null;
	company_description: string | null;
	company: string | null;
	job_poster: string | null;
	date_posted: Date | null;
	location: string | null;
	remote: string | null;
	experience_levels: string[] | null;
	job_type: string | null;
	salary_min: number | null;
	salary_max: number | null;
	salary_currency: string | null;
	salary_period: string | null;
	salary_duration_weeks: number | null;
	skills_required: string[] | null;
	skills_preferred: string[] | null;
	responsibilities: string[] | null;
	soft_skills: string[] | null;
	status: string | null;
	source_url: string | null;
	source_html_stripped: string;
	ai_chat_extraction: number | null;
}

type ExtractJobDataResponse = {
	title?: string | null;
	job_description?: string | null;
	company_description?: string | null;
	company?: string | null;
	job_poster?: string | null;
	date_posted?: string | null;
	location?: string | null;
	remote?: string | null;
	experience_levels?: string[] | null;
	job_type?: string | null;
	salary_min?: number | null;
	salary_max?: number | null;
	salary_currency?: string | null;
	salary_period?: string | null;
	salary_duration_weeks?: number | null;
	skills_required?: string[] | null;
	skills_preferred?: string[] | null;
	responsibilities?: string[] | null;
	soft_skills?: string[] | null;
	status?: string | null;
	source_url?: string | null;
};

const HEADER_FIELDS: (keyof ExtractedHeader)[] = ['title', 'company', 'job_poster', 'location'];

/**
 * Build the search-context hint appended to the extraction prompt. Empty when
 * no context is supplied (the manual-create case).
 */
function buildSearchContextHint(searchContext?: JobSearchContext): string {
	if (!searchContext?.title && !searchContext?.company) return '';

	const parts: string[] = [];
	if (searchContext.title) parts.push(`title: "${searchContext.title}"`);
	if (searchContext.company) parts.push(`company: "${searchContext.company}"`);
	if (searchContext.location) {
		parts.push(`location: "${searchContext.location}"`);
	}

	return (
		`\n\nIMPORTANT: We clicked on a specific job from the search results. ` +
		`Look for the DETAILED job information (full description, requirements, etc.) for this job: ${parts.join(
			', '
		)}. ` +
		`The page may show other job cards in a sidebar - ignore those and extract only the main job's details.`
	);
}

/**
 * Parse a job description into structured fields via the LLM.
 *
 * @param text Raw job-posting text (a user paste) or HTML (a scraped page)
 * @param opts.profileId Profile whose `collected_data` seeds the prompt
 * @param opts.sourceUrl Reserved for future URL-aware extraction (unused today)
 * @param opts.searchContext Optional hints to disambiguate multi-card pages
 * @param opts.recoverHeader Take a second, header-only look when the first
 *   pass leaves title, company, recruiter or location empty. On for the paste
 *   callers — the form, MCP, re-parse of a manual job — where the header is
 *   what the applicant sees first; off for the scraper, whose pages carry it
 *   in markup and which pays per job. One extra call per parse at most.
 * @returns Structured fields, or `null` if extraction was unavailable/failed
 */
export async function parseJobDescription(
	text: string,
	opts: {
		profileId: number;
		sourceUrl?: string | null;
		searchContext?: JobSearchContext;
		recoverHeader?: boolean;
	}
): Promise<ParsedJobDescription | null> {
	// 1. Strip a captured page down to its content; tidy a paste but keep its
	//    lines (they are the only structure it has).
	const preparedText = prepareJobTextForLlm(text);

	// 2. Build search-context hint (empty for manual pastes)
	const searchContextHint = buildSearchContextHint(opts.searchContext);

	// 3. Call the LLM extraction prompt
	const aiResult = await runProfileAiChat<ExtractJobDataResponse>(
		opts.profileId,
		'extract_job_data',
		{ html: preparedText, searchContextHint }
	);

	if (!aiResult.success || !aiResult.response) {
		// Degrade path: let the caller decide what to do with no extraction. Log
		// the underlying reason (provider error, no credits, bad JSON) — callers
		// only see `null`, so this is the only record of *why* it failed.
		console.warn(`[parseJobDescription] extraction returned no result: ${aiResult.message}`);
		return null;
	}

	const data = aiResult.response;

	// 4. If the LLM didn't extract a date, fall back to a "Posted X ago" regex
	let rawDatePosted = data.date_posted ?? null;
	if (!rawDatePosted) {
		const datePattern =
			/Posted\s+(?:a\s+)?(?:\d+\s+)?(?:month|day|week|year|hour|minute)s?\s+ago/gi;
		const matches = preparedText.match(datePattern);
		if (matches && matches.length > 0) {
			// The main job's date typically appears last (after similar-job cards)
			rawDatePosted = matches[matches.length - 1];
		}
	}

	// 5. Parse and validate date_posted
	const parsedDate = parseRelativeDate(rawDatePosted);
	const finalDatePosted = parsedDate && isValidJobPostingDate(parsedDate) ? parsedDate : null;

	// 6. Clean the header fields: echoed labels, section headings returned as
	//    titles, a recruiter that is just the company again → trimmed or null.
	let header = sanitizeExtractedHeader(data);
	let suggestedTitle: string | null = null;

	// 7. A paste that still has a header field empty gets the narrow second
	//    pass. Only the gaps are filled; what the first pass found stands. A
	//    title suggestion is carried only when no title could be found at all.
	if (opts.recoverHeader && HEADER_FIELDS.some((field) => header[field] === null)) {
		const recovered = await recoverPostingHeader(preparedText, opts.profileId);
		header = sanitizeExtractedHeader({
			title: header.title ?? recovered.title,
			company: header.company ?? recovered.company,
			job_poster: header.job_poster ?? recovered.job_poster,
			location: header.location ?? recovered.location
		});
		if (header.title === null) suggestedTitle = recovered.suggested_title;
	}

	return {
		title: header.title,
		suggested_title: suggestedTitle,
		job_description: data.job_description ?? null,
		company_description: data.company_description ?? null,
		company: header.company,
		job_poster: header.job_poster,
		date_posted: finalDatePosted,
		location: header.location,
		remote: data.remote ?? null,
		experience_levels: data.experience_levels ?? null,
		job_type: data.job_type ?? null,
		salary_min: data.salary_min ?? null,
		salary_max: data.salary_max ?? null,
		salary_currency: data.salary_currency ?? null,
		salary_period: data.salary_period ?? null,
		salary_duration_weeks: data.salary_duration_weeks ?? null,
		skills_required: data.skills_required ?? null,
		skills_preferred: data.skills_preferred ?? null,
		responsibilities: data.responsibilities ?? null,
		soft_skills: data.soft_skills ?? null,
		status: data.status ?? null,
		source_url: data.source_url ?? null,
		source_html_stripped: preparedText,
		ai_chat_extraction: aiResult.aiChatId
	};
}
