/**
 * Zod schemas for AI prompt structured outputs
 * Each schema corresponds to a prompt request type that uses structured output
 *
 * NOTE: Only prompts that use structured JSON output are defined here.
 * Prompts that return plain text (like write_cover_letter, answer_application_question)
 * do not require schemas.
 */

import { z } from 'zod';

/**
 * Schema for extract_job_data prompt
 * Extracts structured data from individual job posting pages
 */
// LLMs sometimes return the string "null" instead of JSON null
const coerceNull = (v: unknown) => (v === 'null' || v === 'none' || v === 'N/A' ? null : v);

// Helper for optional nullable fields (field can be missing, null, or have a value)
const optionalNullableString = () => z.preprocess(coerceNull, z.string().optional().nullable());
const optionalNullableNumber = () =>
	z.preprocess(
		(v) => {
			const n = coerceNull(v);
			// Coerce numeric strings like "50000" to actual numbers
			if (typeof n === 'string' && /^\d+(\.\d+)?$/.test(n.trim())) return Number(n);
			return n;
		},
		z
			.number()
			.optional()
			.nullable()
			.transform((v) => (v != null ? Math.round(v) : v))
	);
const optionalNullableArray = () =>
	z.preprocess(coerceNull, z.array(z.string()).optional().nullable());

/**
 * ISO 4217 currency code, uppercased. Anything that isn't three letters — a
 * symbol, a name like "euros", a stray range — becomes null rather than being
 * stored as a bogus code.
 *
 * Deliberately not restricted to a fixed list: `fx_rates` carries ~30
 * currencies and a code outside it still displays correctly, it just can't be
 * converted (`convertCurrency` returns null and comparisons degrade to
 * "unknown"). That's strictly better than dropping the salary entirely, which
 * is what the old EUR/USD/GBP-only prompt did to every other currency.
 */
const coerceCurrency = (v: unknown) => {
	const c = coerceNull(v);
	if (typeof c !== 'string') return c;
	const upper = c.trim().toUpperCase();
	return /^[A-Z]{3}$/.test(upper) ? upper : null;
};

const optionalNullableCurrency = () =>
	z.preprocess(coerceCurrency, z.string().optional().nullable());

export const extractJobDataSchema = z
	.object({
		title: optionalNullableString().describe('Job title'),
		job_description: optionalNullableString().describe('Full job description'),
		company_description: optionalNullableString().describe('Company description'),
		company: optionalNullableString().describe(
			'Name of the company that is hiring for this position'
		),
		job_poster: optionalNullableString().describe(
			'Name of recruiter, recruitment agency, or person who posted the job (NOT the hiring company)'
		),
		date_posted: optionalNullableString().describe('Date the job was posted (ISO 8601 format)'),
		location: optionalNullableString().describe('Physical office location (city, region, country)'),
		remote: optionalNullableString().describe('Work location type (remote, hybrid, or onsite)'),
		experience_levels: optionalNullableArray().describe(
			'Array of applicable experience levels (entry, junior, mid, senior, lead, principal, executive)'
		),
		job_type: optionalNullableString().describe('Employment type'),
		salary_min: optionalNullableNumber().describe('Minimum salary amount'),
		salary_max: optionalNullableNumber().describe('Maximum salary amount'),
		salary_currency: optionalNullableCurrency().describe(
			'ISO 4217 currency code as stated in the posting (EUR, USD, GBP, DKK, SEK, CHF, …)'
		),
		salary_period: optionalNullableString().describe(
			'Pay period (hour, day, week, month, year, project)'
		),
		salary_duration_weeks: optionalNullableNumber().describe(
			'For project/fixed-price jobs: estimated duration in weeks. null for periodic salaries.'
		),
		skills_required: optionalNullableArray().describe(
			'Array of REQUIRED TECHNICAL skills/technologies, ordered by importance (most critical first)'
		),
		skills_preferred: optionalNullableArray().describe(
			'Array of PREFERRED/nice-to-have TECHNICAL skills, ordered by importance (most desired first)'
		),
		responsibilities: optionalNullableArray().describe(
			'Array of key job responsibilities/duties, ordered by importance'
		),
		soft_skills: optionalNullableArray().describe(
			'Array of soft skills/personality traits (communication, leadership, teamwork, etc.)'
		),
		status: optionalNullableString().describe(
			'Whether the job is currently accepting applications'
		),
		source_url: optionalNullableString().describe(
			'Direct URL to this specific job posting, if one appears in the content'
		)
	})
	.passthrough(); // Allow extra keys LLMs may add like $schema, definitions

/**
 * Schema for score_job_match prompt
 * Evaluates how well a job matches a candidate's profile
 */
export const scoreJobMatchSchema = z.object({
	score: z.number().int().min(0).max(100).describe('Overall match score'),
	summary: z
		.string()
		.describe(
			'One concise sentence (max 100 chars) summarizing why this job matches the candidate'
		),
	skill_match_percentage: z
		.number()
		.int()
		.min(0)
		.max(100)
		.describe('Percentage of required skills the candidate has'),
	matched_skills: z
		.array(z.string())
		.default([])
		.describe(
			'EXACT skill names from job.skills_required or job.skills_preferred that the candidate has. Copy strings verbatim - do not paraphrase.'
		),
	strengths: z
		.array(z.string())
		.min(0)
		.max(10)
		.describe('Top 3-5 reasons why this is a good match'),
	gaps: z
		.array(z.string())
		.min(0)
		.max(10)
		.describe("Areas where candidate doesn't meet requirements"),
	recommendation: z
		.enum(['highly_recommend', 'recommend', 'consider', 'not_recommended'])
		.describe('Overall recommendation')
});

/**
 * Schema for detect_login_page prompt
 * Determines if a page is a login/authentication page
 */
export const detectLoginPageSchema = z.object({
	isLoginPage: z.boolean().describe('True if this is a login/authentication page'),
	confidence: z.number().min(0.0).max(1.0).describe('Confidence score from 0.0 to 1.0'),
	indicators: z
		.array(z.string())
		.describe('List of indicators found that led to this determination')
});

/**
 * Schema for check_login_state prompt
 * Determines if user is logged in after navigating to login page
 */
export const checkLoginStateSchema = z.object({
	is_logged_in: z.boolean().describe('True if user appears to be logged in (not on a login page)'),
	confidence: z.enum(['high', 'medium', 'low']).describe('Confidence level in the determination'),
	reason: z.string().describe('Brief explanation of the determination')
});

/**
 * Schema for find_next_page_button prompt
 * Finds pagination button using data-xxx markers
 */
export const findNextPageButtonSchema = z.object({
	found: z.boolean().describe('True if a next page button was found'),
	dataXxxId: z
		.number()
		.int()
		.nullable()
		.describe('The data-xxx attribute value of the next button, or null if not found'),
	paginationType: z
		.enum(['next_prev', 'load_more', 'none'])
		.describe('The type of pagination button found')
});

/**
 * Schema for extract_jobs_from_search_page prompt
 * Extracts job information from search results page (SPA click-scraper)
 */
export const extractJobsFromSearchPageSchema = z
	.object({
		jobs: z.array(
			z
				.object({
					clickableId: z
						.number()
						.int()
						.nullable()
						.describe('EXACT data-xxx from HTML - do not invent. null if no data-xxx found'),
					title: z.string().nullable().describe('Job title/position name'),
					company: z.string().nullable().describe('Company or employer name'),
					location: z
						.string()
						.nullable()
						.describe('Physical office location (city, region, country)'),
					salary_min: z
						.preprocess((v) => {
							const n = coerceNull(v);
							return typeof n === 'string' && /^\d+(\.\d+)?$/.test(n.trim()) ? Number(n) : n;
						}, z.number().nullable())
						.describe('Minimum salary as numeric value only'),
					salary_max: z
						.preprocess((v) => {
							const n = coerceNull(v);
							return typeof n === 'string' && /^\d+(\.\d+)?$/.test(n.trim()) ? Number(n) : n;
						}, z.number().nullable())
						.describe('Maximum salary as numeric value only'),
					salary_currency: z
						.preprocess(coerceCurrency, z.string().nullable())
						.describe('ISO 4217 currency code as stated (USD, EUR, DKK, etc.)'),
					salary_period: z
						.string()
						.nullable()
						.describe('Salary period (year, month, week, hour, day, project)'),
					salary_duration_weeks: z
						.number()
						.nullable()
						.optional()
						.describe('For project/fixed-price: duration in weeks'),
					skills_required: z
						.array(z.string())
						.nullable()
						.describe('Array of REQUIRED skills, ordered by importance (most critical first)'),
					skills_preferred: z
						.array(z.string())
						.nullable()
						.describe('Array of PREFERRED skills, ordered by importance (most desired first)'),
					remote: z.string().nullable().describe('Work location type (remote, hybrid, or onsite)'),
					date_posted: z
						.string()
						.nullable()
						.describe('Date posted - preserve original format from HTML')
				})
				.passthrough() // Allow extra fields LLMs might add
		)
	})
	.passthrough(); // Allow extra keys like pattern, jobCount that LLMs might add

/**
 * Schema for tailor_resume_selection prompt
 *
 * The model reviews a shortlist the deterministic layers already produced and
 * says which entries it would keep or drop for this job. Deliberately loose —
 * `ref` and `action` are plain strings, validated in code against the shortlist
 * — because a strict enum here buys nothing (an unknown ref is dropped either
 * way) and costs a retry loop when the model answers with a near-miss. Same
 * lesson as the capability proposals: a flat LIST of decisions survives round
 * trips that an object with optional keys does not.
 */
export const tailorResumeSelectionSchema = z.object({
	decisions: z
		.array(
			z
				.object({
					ref: z.string().describe('The exact ref string from the shortlist, e.g. "bullet:412".'),
					action: z.string().describe('Either "keep" or "drop".'),
					reason: z.string().describe('One short sentence, addressed to the applicant, saying why.')
				})
				.passthrough()
		)
		.describe('One entry per shortlist item you want to change or confirm.')
});

/**
 * Schema for extract_matched_skills prompt
 * Extracts which job skills the candidate has via semantic matching
 * Returns job skill strings (not candidate skill names) that the candidate matches
 */
export const extractMatchedSkillsSchema = z.object({
	matched_skills: z
		.array(z.string())
		.describe(
			'Job skills from the provided list that the candidate possesses (exact job skill strings).'
		)
});

/**
 * Schema for estimate_salary_expectations prompt
 * Estimates salary rates for a specific combination of parameters
 */
export const estimateSalaryExpectationsSchema = z.object({
	hourly_rate: z.number().int().nullable().describe('Estimated hourly rate'),
	daily_rate: z.number().int().nullable().describe('Estimated daily rate'),
	month_salary: z.number().int().nullable().describe('Estimated monthly salary'),
	year_salary: z.number().int().nullable().describe('Estimated yearly salary'),
	confidence: z
		.enum(['high', 'medium', 'low'])
		.optional()
		.default('medium')
		.describe('Confidence level in the estimates'),
	reasoning: z
		.string()
		.optional()
		.default('')
		.describe('Brief explanation of how the estimates were derived')
});

/**
 * Schema for derive_record_metadata.
 *
 * Deliberately LOOSE on the wire — no `.transform()` or `.preprocess()`, which
 * throw "Transforms cannot be represented in JSON Schema" once LangChain
 * converts this for structured output. Tightening happens on our side of the
 * boundary in record-derivation.ts, which is also where an unknown
 * `record_type` or `role` is dropped rather than trusted.
 *
 * Every field is required rather than optional: gpt-oss omits nullable keys
 * unless told not to, and an absent key is indistinguishable from "the model
 * found nothing" — which matters here, because "no contacts" is a real signal
 * (see the authorship aggregate in planning/APPLICATION-ACTIVITY.md).
 */
export const deriveRecordMetadataSchema = z.object({
	title: z
		.string()
		.describe('A short scannable title for this entry, 3-10 words. No trailing period.'),
	record_type: z.string().describe('Exactly one of the allowed type values listed in the prompt.'),
	event_date: z
		.string()
		.nullable()
		.describe('The date the thing described actually happened, as YYYY-MM-DD, or null.'),
	contacts: z
		.array(
			z.object({
				name: z.string().describe("The person's name as written."),
				role: z
					.string()
					.nullable()
					.describe('Exactly one of the allowed role values, or null when unclear.')
			})
		)
		.describe("People from the employer's side named in the entry. Empty array if none.")
});

/**
 * Schema for summarize_application.
 *
 * Loose on the wire for the same reason as deriveRecordMetadataSchema: a
 * `.transform()` here throws "Transforms cannot be represented in JSON Schema"
 * under LangChain. Every key required, because gpt-oss omits nullable ones and
 * an absent `offer` is indistinguishable from "there is no offer" — which is
 * exactly the distinction the comparison spine turns on.
 */
export const summarizeApplicationSchema = z.object({
	summary: z
		.string()
		.describe('3-6 sentences on where this application stands and what has happened.'),
	offer: z
		.object({
			base: z
				.union([z.number(), z.string()])
				.nullable()
				.describe('Base salary as a number, or null.'),
			// string|number throughout, because gpt-oss returns "0.15% over 4 years"
			// for one offer and the bare number 0.15 for the next. Measured: a strict
			// z.string() here failed the whole parse on `equity`, losing the summary
			// and the deadline along with it. Tightening happens in coerceOffer, on
			// our side of the boundary — see the same lesson in record-derivation.ts.
			bonus: z.union([z.string(), z.number()]).nullable(),
			equity: z.union([z.string(), z.number()]).nullable(),
			currency: z.string().nullable().describe('ISO code, e.g. EUR.'),
			period: z.string().nullable().describe('year, month, day or hour.'),
			start_date: z.string().nullable().describe('YYYY-MM-DD or null.'),
			respond_by: z.string().nullable().describe('YYYY-MM-DD or null.'),
			notes: z.union([z.string(), z.number()]).nullable()
		})
		.nullable()
		.describe("The offer's terms, or null when no offer has been made."),
	// Loose on `category` and `record_id` for the same reason as `offer` above:
	// an enum here would fail the WHOLE parse over one invented category, taking
	// the summary and the offer deadline down with it. coerceDetails normalises
	// an unknown category to "other" and drops a citation to an entry that was
	// never shown — see $lib/application-details.ts.
	details: z
		.array(
			z.object({
				category: z
					.string()
					.describe(
						'One of: requirement, compensation, logistics, commitment, role_detail, other.'
					),
				label: z.string().describe('Short noun phrase naming the thing.'),
				value: z.string().describe('The fact itself, in one line.'),
				record_id: z
					.union([z.number(), z.string()])
					.nullable()
					.describe('The [entry N] number this came from, or null.')
			})
		)
		.describe('Concrete details worth remembering. Empty array when there are none.')
});

/**
 * Preprocess to normalize the "text" key from LLMs that use alternative names
 * (e.g. "coverLetter", "cover_letter", "letter", "content", "email")
 */
const normalizeTextKey = (val: unknown) => {
	if (val && typeof val === 'object') {
		const obj = val as Record<string, unknown>;

		// If "text" exists but is an array (e.g. structured cheat sheet), flatten to markdown
		if ('text' in obj && Array.isArray(obj.text)) {
			const flatten = (items: unknown[]): string =>
				items
					.map((item) => {
						if (typeof item === 'string') return item;
						if (item && typeof item === 'object') {
							const o = item as Record<string, unknown>;
							const parts: string[] = [];
							if (typeof o.title === 'string') parts.push(`## ${o.title}`);
							if (Array.isArray(o.points)) {
								parts.push(...o.points.map((p: unknown) => `- ${p}`));
							}
							if (typeof o.content === 'string') parts.push(o.content);
							return parts.join('\n');
						}
						return String(item);
					})
					.join('\n\n');
			return { ...obj, text: flatten(obj.text) };
		}

		// If "text" key is missing, try alternative key names
		if (!('text' in obj)) {
			const altKeys = [
				'letter',
				'coverLetter',
				'cover_letter',
				'cheatSheet',
				'cheat_sheet',
				'content',
				'email',
				'body',
				'revisedLetter',
				'revised_letter',
				'revisedText',
				'revised_text'
			];
			for (const key of altKeys) {
				if (key in obj && typeof obj[key] === 'string') {
					return { ...obj, text: obj[key] };
				}
			}
		}
	}
	return val;
};

/**
 * Schema for text generation prompts (cover letter, cheat sheet, etc.)
 * Returns the text content only, no preamble or commentary.
 */
export const writeLetterSchema = z.preprocess(
	normalizeTextKey,
	z.object({
		// Feedback is declared FIRST on purpose: gpt-oss tends to drop a trailing
		// short field after emitting a long one, so writing the short note before
		// the long text makes it far more likely to be included.
		// Optional so a response that still drops it (or uses the legacy `letter`
		// key) validates — it degrades to no feedback bubble rather than failing
		// the whole generation.
		feedback: z
			.string()
			.optional()
			.describe(
				'A brief note (1-2 sentences) to the applicant citing the SPECIFIC profile experiences, skills, or projects you drew on to write this. Name the actual entries; be concrete.'
			),
		text: z.string().describe('The complete text, ready to use. No preamble or commentary.')
	})
);

/**
 * Schema for text followup prompts (feedback-based revisions)
 * Returns the revised text plus brief feedback on the user's version.
 */
export const followupLetterSchema = z.preprocess(
	normalizeTextKey,
	z.object({
		// Nullable AND optional: the model returns text only when it writes/changes
		// the answer. When the user just asked a question or wanted advice, it
		// replies in `feedback` and leaves text null/absent (no new version).
		text: z
			.string()
			.nullable()
			.optional()
			.describe(
				'The complete revised text, ready to use. Include ONLY when the user asked you to write or change the answer. Set to null when they asked a question or wanted advice/discussion — put your reply in feedback instead.'
			),
		feedback: z
			.string()
			.optional()
			.describe(
				"Your reply to the user's message. When you wrote/changed the text: a brief note of what you did. When they asked a question or wanted advice: your full, specific answer/advice."
			)
	})
);

/**
 * Schema for text review prompts
 * Returns feedback (markdown) and optionally a revised version of the text.
 */
export const reviewLetterSchema = z.object({
	feedback: z
		.string()
		.describe(
			'A single markdown string with concise, friendly feedback. What works, what to improve, with specific suggestions. NOT an array — one cohesive markdown text.'
		),
	revisedText: z
		.string()
		.nullable()
		.describe(
			'The complete revised text incorporating suggestions. Include ONLY when substantive changes are needed. Set to null when the text is good and feedback is minor (e.g. small tweaks the user can make themselves). Plain text, ready to use as-is. No markdown formatting, no preamble.'
		)
});

/**
 * Schema for write_star_story prompt.
 *
 * The story narrative comes back as ONE markdown document in `text` (## Situation
 * / ## Task / ## Action / ## Result / optional ## Reflection) — the editor splits
 * it into the STAR columns via $lib/interview/star. `title` is only applied when
 * the story doesn't have one yet. Reuses normalizeTextKey so a stray `content`/
 * `story` key or an accidentally-arrayed body still validates.
 */
export const writeStarStorySchema = z.preprocess(
	normalizeTextKey,
	z.object({
		// Declared first: gpt-oss tends to drop a trailing short field after a long
		// one, so the short note precedes the long narrative. Optional → a dropped
		// note degrades to no feedback bubble rather than failing the generation.
		feedback: z
			.string()
			.optional()
			.describe(
				'A brief note (1-2 sentences) to the applicant citing the SPECIFIC profile experiences, projects, or roles you drew on. Name the actual entries; be concrete.'
			),
		text: z
			.string()
			.describe(
				"The complete STAR story as markdown with '## Situation', '## Task', '## Action', '## Result' headings and an optional '## Reflection'. First person, ready to use. No preamble, no other headings."
			),
		title: z
			.string()
			.optional()
			.nullable()
			.describe(
				"A short, specific title for this story (≤60 chars), e.g. 'Led the migration off a jammed job queue'. Only used when the story has no title yet."
			)
	})
);

/**
 * Schema for write_or_advise_star_story — the unified STAR entry point. Nullable
 * text (null when the model advised instead of writing), a feedback reply, and
 * an optional title used only when writing a story that has none yet. Reuses
 * normalizeTextKey so a stray `story`/`content` key still validates.
 */
export const writeOrAdviseStorySchema = z.preprocess(
	normalizeTextKey,
	z.object({
		text: z
			.string()
			.nullable()
			.optional()
			.describe(
				'The complete STAR story as markdown (## Situation / ## Task / ## Action / ## Result, optional ## Reflection). Include ONLY when writing the story. Set to null when the applicant asked a question or wanted advice — put your reply in feedback instead.'
			),
		feedback: z
			.string()
			.optional()
			.describe(
				'Your reply. When you wrote the story: a brief grounding note naming the profile experiences you drew on. When they asked a question or wanted advice: your full, specific answer.'
			),
		title: z
			.string()
			.optional()
			.nullable()
			.describe(
				'A short, specific title (≤60 chars). Only when you wrote the story and it has no title yet.'
			)
	})
);

/**
 * Schema for write_prep_sheet — a profile-level interview cheat sheet. One
 * markdown document in `text`, a grounding note in `feedback`, and a `title`
 * applied only when the sheet has none yet. Reuses normalizeTextKey so a stray
 * `content`/`sheet` key or an accidentally-arrayed body still validates.
 */
export const writePrepSheetSchema = z.preprocess(
	normalizeTextKey,
	z.object({
		feedback: z
			.string()
			.optional()
			.describe(
				'A brief note (1-2 sentences) citing the SPECIFIC profile experiences, skills, or projects you built the sheet around. Name the actual entries; be concrete.'
			),
		text: z
			.string()
			.describe(
				'The complete cheat sheet as a single markdown string — headers, bullets, bold. Scannable quick-reference, not prose. No preamble.'
			),
		title: z
			.string()
			.optional()
			.nullable()
			.describe(
				'A short, specific title for this cheat sheet (≤60 chars). Only used when the sheet has no title yet.'
			)
	})
);

/**
 * Schema for write_or_advise_prep_sheet — the unified cheat-sheet entry point.
 * Nullable text (null when the model advised instead of writing), a feedback
 * reply, and an optional title used only when writing a sheet that has none yet.
 */
export const writeOrAdvisePrepSheetSchema = z.preprocess(
	normalizeTextKey,
	z.object({
		text: z
			.string()
			.nullable()
			.optional()
			.describe(
				'The complete cheat sheet as a single markdown string. Include ONLY when writing the sheet. Set to null when the applicant asked a question or wanted advice — put your reply in feedback instead.'
			),
		feedback: z
			.string()
			.optional()
			.describe(
				'Your reply. When you wrote the sheet: a brief grounding note naming the profile experiences you drew on. When they asked a question or wanted advice: your full, specific answer.'
			),
		title: z
			.string()
			.optional()
			.nullable()
			.describe(
				'A short, specific title (≤60 chars). Only when you wrote the sheet and it has no title yet.'
			)
	})
);

/**
 * Schema for suggest_import_tasks prompt
 *
 * The LLM returns ONE entry per suggestable platform, ranked high→low,
 * SKIPPING any (platform, keywords) combination that already exists as a
 * task. It picks keywords, ranks fit, and writes a short note. Filters are
 * NOT in scope for the LLM — the server computes them deterministically
 * from the user's preferences (see preferences-to-filters.ts) and merges
 * them in after this response is parsed. The array can be empty when every
 * suggestable platform is already covered by an existing task.
 */
export const suggestImportTasksSchema = z.object({
	tasks: z.array(
		z.object({
			platform_id: z
				.number()
				.int()
				.describe(
					'ID of the job platform to use. MUST be one of the platform IDs from the platforms_list provided in the system prompt.'
				),
			keywords: z
				.string()
				.nullable()
				.describe(
					"Plain (NOT URL-encoded) keyword string the scraper will type into the platform's search input. Null when the platform is a curated single-page listing (no search box) and the user should import everything — pick this only when the platform's hint says so."
				),
			note: z
				.string()
				.describe(
					"Short task label (≤60 chars) — the role/title this search is for, drawn from the profile's title/headline (e.g. 'Full-Stack Developer'). No explanation, no platform name."
				),
			relevance: z
				.enum(['high', 'medium', 'low'])
				.describe('How well this platform matches the profile.')
		})
	)
});

/**
 * Schema for extract_qa_pairs prompt
 *
 * The LLM splits a free-text blob the applicant pasted into discrete
 * question/answer pairs, preserving their wording verbatim (extraction, not
 * editing). `question` may be an empty string when a chunk is clearly an
 * answer but its question can't be identified — the preview UI surfaces
 * those (and any `confidence: "low"` pair) for the user to fix before the
 * pairs are saved as application_questions rows.
 */
export const extractQaPairsSchema = z.preprocess(
	// gpt-oss sometimes returns the bare array instead of the wrapped object
	// (`[{...}]` rather than `{ pairs: [{...}] }`). Coerce that shape so the
	// extraction doesn't fail on an otherwise-valid response.
	(value) => (Array.isArray(value) ? { pairs: value } : value),
	z.object({
		pairs: z.array(
			z.object({
				question: z
					.string()
					.describe(
						'The question being answered, verbatim. Empty string when the text is clearly an answer but its question cannot be identified.'
					),
				answer: z
					.string()
					.describe("The applicant's answer, verbatim — not rewritten, summarized, or translated."),
				confidence: z
					.enum(['high', 'low'])
					.describe(
						'"low" when the question/answer split was ambiguous (missing or merely-implied question, unclear boundary); otherwise "high".'
					)
			})
		)
	})
);

/**
 * Schema for revise_application_question prompt
 *
 * The model returns just the revised answer text (no feedback). A bare string
 * or `{ text }` is coerced into `{ revisedText }` to tolerate gpt-oss shape
 * drift, mirroring the other structured prompts.
 */
export const reviseAnswerSchema = z.preprocess(
	(value) => {
		if (typeof value === 'string') return { revisedText: value };
		if (value && typeof value === 'object' && !('revisedText' in value)) {
			const v = value as Record<string, unknown>;
			if (typeof v.text === 'string') return { revisedText: v.text };
			if (typeof v.answer === 'string') return { revisedText: v.answer };
		}
		return value;
	},
	z.object({
		revisedText: z
			.string()
			.describe(
				'The complete revised answer, plain text, ready to paste. No preamble or markdown headers.'
			)
	})
);

/**
 * Schema registry mapping request identifiers to Zod schemas
 * This provides type-safe lookup of schemas by prompt request name
 */
/**
 * Schema for extract_document prompt.
 * Summarizes an uploaded document / source-code project into reference notes
 * plus key technologies. gpt-oss sometimes returns the summary as a list of
 * sentences or the keywords as a comma-joined string — coerce both.
 */
export const extractDocumentSchema = z
	.object({
		summary: z
			.preprocess(
				(v) => (Array.isArray(v) ? v.join('\n\n') : coerceNull(v)),
				z.string().optional().nullable()
			)
			.describe('Short reference-notes summary of the document/project'),
		keywords: z
			.preprocess((v) => {
				const n = coerceNull(v);
				if (typeof n === 'string') {
					return n
						.split(',')
						.map((s) => s.trim())
						.filter(Boolean);
				}
				return n ?? [];
			}, z.array(z.string()).default([]))
			.describe('Key technologies/keywords, ordered by prominence')
	})
	.passthrough();

export const aiPromptSchemas = {
	extract_job_data: extractJobDataSchema,
	derive_record_metadata: deriveRecordMetadataSchema,
	summarize_application: summarizeApplicationSchema,
	extract_document: extractDocumentSchema,
	extract_jobs_from_search_page: extractJobsFromSearchPageSchema,
	score_job_match: scoreJobMatchSchema,
	extract_matched_skills: extractMatchedSkillsSchema,
	detect_login_page: detectLoginPageSchema,
	find_next_page_button: findNextPageButtonSchema,
	check_login_state: checkLoginStateSchema,
	estimate_salary_expectations: estimateSalaryExpectationsSchema,
	write_cover_letter: writeLetterSchema,
	// Model decides per-message: a full draft (text set) or advice (text null).
	write_or_advise_cover_letter: followupLetterSchema,
	write_or_advise_cheat_sheet: followupLetterSchema,
	write_or_advise_application_question: followupLetterSchema,
	write_or_advise_star_story: writeOrAdviseStorySchema,
	write_cheat_sheet: writeLetterSchema,
	answer_application_question: writeLetterSchema,
	followup_letter: followupLetterSchema,
	followup_application_question: followupLetterSchema,
	review_cover_letter: reviewLetterSchema,
	review_cheat_sheet: reviewLetterSchema,
	review_application_question: reviewLetterSchema,
	write_star_story: writeStarStorySchema,
	followup_star_story: followupLetterSchema,
	review_star_story: reviewLetterSchema,
	// Profile-level interview cheat sheets ("prep sheets"). advise_prep_sheet
	// returns plain markdown (no schema), like the other advise_* prompts.
	write_prep_sheet: writePrepSheetSchema,
	write_or_advise_prep_sheet: writeOrAdvisePrepSheetSchema,
	followup_prep_sheet: followupLetterSchema,
	review_prep_sheet: reviewLetterSchema,
	suggest_import_tasks: suggestImportTasksSchema,
	extract_qa_pairs: extractQaPairsSchema,
	revise_application_question: reviseAnswerSchema,
	tailor_resume_selection: tailorResumeSelectionSchema
} as const;

/**
 * Get Zod schema for a prompt request
 * @param request - Prompt request identifier
 * @returns Zod schema or undefined if not found
 */
export function getSchemaForPrompt(request: string): z.ZodType<any> | undefined {
	return aiPromptSchemas[request as keyof typeof aiPromptSchemas];
}

/**
 * Type helper to infer the output type from a schema
 */
export type AiPromptSchemaOutput<K extends keyof typeof aiPromptSchemas> = z.infer<
	(typeof aiPromptSchemas)[K]
>;
