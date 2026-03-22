/**
 * Zod schemas for AI prompt structured outputs
 * Each schema corresponds to a prompt request type that uses structured output
 *
 * NOTE: Only prompts that use structured JSON output are defined here.
 * Prompts that return plain text (like write_cover_letter, answer_application_question)
 * do not require schemas.
 */

import { z } from "zod";

/**
 * Schema for extract_job_data prompt
 * Extracts structured data from individual job posting pages
 */
// LLMs sometimes return the string "null" instead of JSON null
const coerceNull = (v: unknown) => (v === "null" || v === "none" || v === "N/A" ? null : v);

// Helper for optional nullable fields (field can be missing, null, or have a value)
const optionalNullableString = () =>
  z.preprocess(coerceNull, z.string().optional().nullable());
const optionalNullableNumber = () =>
  z.preprocess(
    (v) => {
      const n = coerceNull(v);
      // Coerce numeric strings like "50000" to actual numbers
      if (typeof n === "string" && /^\d+(\.\d+)?$/.test(n.trim())) return Number(n);
      return n;
    },
    z.number().optional().nullable().transform((v) => (v != null ? Math.round(v) : v)),
  );
const optionalNullableArray = () =>
  z.preprocess(coerceNull, z.array(z.string()).optional().nullable());

export const extractJobDataSchema = z.object({
  title: optionalNullableString().describe("Job title"),
  job_description: optionalNullableString().describe("Full job description"),
  company_description: optionalNullableString().describe("Company description"),
  company: optionalNullableString().describe(
    "Name of the company that is hiring for this position",
  ),
  job_poster: optionalNullableString().describe(
    "Name of recruiter, recruitment agency, or person who posted the job (NOT the hiring company)",
  ),
  date_posted: optionalNullableString().describe(
    "Date the job was posted (ISO 8601 format)",
  ),
  location: optionalNullableString().describe(
    "Physical office location (city, region, country)",
  ),
  remote: optionalNullableString().describe(
    "Work location type (remote, hybrid, or onsite)",
  ),
  experience_levels: optionalNullableArray().describe(
    "Array of applicable experience levels (entry, junior, mid, senior, lead, principal, executive)",
  ),
  job_type: optionalNullableString().describe("Employment type"),
  salary_min: optionalNullableNumber().describe("Minimum salary amount"),
  salary_max: optionalNullableNumber().describe("Maximum salary amount"),
  salary_currency: optionalNullableString().describe(
    "Currency code (EUR, USD, GBP)",
  ),
  salary_period: optionalNullableString().describe(
    "Pay period (hour, day, month, year)",
  ),
  skills_required: optionalNullableArray().describe(
    "Array of REQUIRED TECHNICAL skills/technologies, ordered by importance (most critical first)",
  ),
  skills_preferred: optionalNullableArray().describe(
    "Array of PREFERRED/nice-to-have TECHNICAL skills, ordered by importance (most desired first)",
  ),
  responsibilities: optionalNullableArray().describe(
    "Array of key job responsibilities/duties, ordered by importance",
  ),
  soft_skills: optionalNullableArray().describe(
    "Array of soft skills/personality traits (communication, leadership, teamwork, etc.)",
  ),
  status: optionalNullableString().describe(
    "Whether the job is currently accepting applications",
  ),
}).passthrough(); // Allow extra keys LLMs may add like $schema, definitions

/**
 * Schema for score_job_match prompt
 * Evaluates how well a job matches a candidate's profile
 */
export const scoreJobMatchSchema = z.object({
  score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Overall match score"),
  summary: z.string().describe("One concise sentence (max 100 chars) summarizing why this job matches the candidate"),
  reasoning: z.string().describe("Detailed explanation of the score"),
  skill_match_percentage: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Percentage of required skills the candidate has"),
  matched_skills: z
    .array(z.string())
    .default([])
    .describe("EXACT skill names from job.skills_required or job.skills_preferred that the candidate has. Copy strings verbatim - do not paraphrase."),
  strengths: z
    .array(z.string())
    .min(0)
    .max(10)
    .describe("Top 3-5 reasons why this is a good match"),
  gaps: z
    .array(z.string())
    .min(0)
    .max(10)
    .describe("Areas where candidate doesn't meet requirements"),
  recommendation: z
    .enum(["highly_recommend", "recommend", "consider", "not_recommended"])
    .describe("Overall recommendation"),
});

/**
 * Schema for detect_login_page prompt
 * Determines if a page is a login/authentication page
 */
export const detectLoginPageSchema = z.object({
  isLoginPage: z
    .boolean()
    .describe("True if this is a login/authentication page"),
  confidence: z
    .number()
    .min(0.0)
    .max(1.0)
    .describe("Confidence score from 0.0 to 1.0"),
  indicators: z
    .array(z.string())
    .describe("List of indicators found that led to this determination"),
});

/**
 * Schema for check_login_state prompt
 * Determines if user is logged in after navigating to login page
 */
export const checkLoginStateSchema = z.object({
  is_logged_in: z
    .boolean()
    .describe("True if user appears to be logged in (not on a login page)"),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("Confidence level in the determination"),
  reason: z.string().describe("Brief explanation of the determination"),
});

/**
 * Schema for find_next_page_button prompt
 * Finds pagination button using data-xxx markers
 */
export const findNextPageButtonSchema = z.object({
  found: z
    .boolean()
    .describe("True if a next page button was found"),
  dataXxxId: z
    .number()
    .int()
    .nullable()
    .describe(
      "The data-xxx attribute value of the next button, or null if not found",
    ),
  paginationType: z
    .enum(["next_prev", "load_more", "none"])
    .describe("The type of pagination button found"),
});

/**
 * Schema for extract_jobs_from_search_page prompt
 * Extracts job information from search results page (SPA click-scraper)
 */
export const extractJobsFromSearchPageSchema = z.object({
  jobs: z.array(
    z.object({
      clickableId: z.number().int().describe(
        "EXACT data-xxx from HTML - do not invent",
      ),
      title: z.string().nullable().describe("Job title/position name"),
      company: z.string().nullable().describe("Company or employer name"),
      location: z.string().nullable().describe(
        "Physical office location (city, region, country)",
      ),
      salary_min: z.preprocess(
        (v) => { const n = coerceNull(v); return typeof n === "string" && /^\d+(\.\d+)?$/.test(n.trim()) ? Number(n) : n; },
        z.number().nullable(),
      ).describe("Minimum salary as numeric value only"),
      salary_max: z.preprocess(
        (v) => { const n = coerceNull(v); return typeof n === "string" && /^\d+(\.\d+)?$/.test(n.trim()) ? Number(n) : n; },
        z.number().nullable(),
      ).describe("Maximum salary as numeric value only"),
      salary_currency: z.string().nullable().describe(
        "Currency code (USD, EUR, GBP, etc.)",
      ),
      salary_period: z.string().nullable().describe(
        "Salary period (year, month, hour, day)",
      ),
      skills_required: z.array(z.string()).nullable().describe(
        "Array of REQUIRED skills, ordered by importance (most critical first)",
      ),
      skills_preferred: z.array(z.string()).nullable().describe(
        "Array of PREFERRED skills, ordered by importance (most desired first)",
      ),
      remote: z.string().nullable().describe(
        "Work location type (remote, hybrid, or onsite)",
      ),
      date_posted: z.string().nullable().describe(
        "Date posted - preserve original format from HTML",
      ),
    }).passthrough(), // Allow extra fields LLMs might add
  ),
}).passthrough(); // Allow extra keys like pattern, jobCount that LLMs might add

/**
 * Schema for extract_matched_skills prompt
 * Extracts which job skills the candidate has via semantic matching
 * Returns job skill strings (not candidate skill names) that the candidate matches
 */
export const extractMatchedSkillsSchema = z.object({
  matched_skills: z
    .array(z.string())
    .describe("Job skills from the provided list that the candidate possesses (exact job skill strings)."),
});

/**
 * Schema registry mapping request identifiers to Zod schemas
 * This provides type-safe lookup of schemas by prompt request name
 *
 * NOTE: Only prompts with structured output are included here.
 * Text-only prompts (write_cover_letter, write_motivation_letter, etc.)
 * are not included as they don't use structured JSON output.
 */
export const aiPromptSchemas = {
  extract_job_data: extractJobDataSchema,
  extract_jobs_from_search_page: extractJobsFromSearchPageSchema,
  score_job_match: scoreJobMatchSchema,
  extract_matched_skills: extractMatchedSkillsSchema,
  detect_login_page: detectLoginPageSchema,
  find_next_page_button: findNextPageButtonSchema,
  check_login_state: checkLoginStateSchema,
} as const;

/**
 * Get Zod schema for a prompt request
 * @param request - Prompt request identifier
 * @returns Zod schema or undefined if not found
 */
export function getSchemaForPrompt(
  request: string,
): z.ZodType<any> | undefined {
  return aiPromptSchemas[request as keyof typeof aiPromptSchemas];
}

/**
 * Type helper to infer the output type from a schema
 */
export type AiPromptSchemaOutput<K extends keyof typeof aiPromptSchemas> =
  z.infer<typeof aiPromptSchemas[K]>;
