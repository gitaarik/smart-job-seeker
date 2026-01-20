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
 * Schema for extract_job_links prompt
 * Extracts job posting URLs from search results HTML
 */
export const extractJobLinksSchema = z.object({
  urls: z
    .array(z.string().describe("Full URL to a job posting"))
    .describe("Array of job posting URLs found in the search results"),
});

/**
 * Schema for extract_job_data prompt
 * Extracts structured data from individual job posting pages
 */
export const extractJobDataSchema = z.object({
  title: z.string().nullable().describe("Job title"),
  job_description: z.string().nullable().describe("Full job description"),
  company_description: z
    .string()
    .nullable()
    .describe("Company description"),
  job_poster: z
    .string()
    .nullable()
    .describe("Name of person who posted the job"),
  date_posted: z
    .string()
    .nullable()
    .describe("Date the job was posted (ISO 8601 format)"),
  location: z.string().nullable().describe("Job location"),
  remote: z.string().nullable().describe("Remote work policy"),
  experience_level: z
    .string()
    .nullable()
    .describe("Required experience level"),
  job_type: z.string().nullable().describe("Employment type"),
  salary_min: z
    .number()
    .int()
    .nullable()
    .describe("Minimum salary amount"),
  salary_max: z
    .number()
    .int()
    .nullable()
    .describe("Maximum salary amount"),
  salary_currency: z
    .string()
    .nullable()
    .describe("Currency code (EUR, USD, GBP)"),
  salary_period: z
    .string()
    .nullable()
    .describe("Pay period (hour, day, month, year)"),
  skills: z
    .array(z.string())
    .nullable()
    .describe("Array of required skills and technologies"),
  status: z
    .string()
    .nullable()
    .describe("Whether the job is currently accepting applications"),
});

/**
 * Schema for extract_job_data_browser_use prompt
 * Same as extract_job_data, used by Browser-Use agent
 */
export const extractJobDataBrowserUseSchema = extractJobDataSchema;

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
  summary: z.string().describe("1-2 paragraph summary of the match"),
  reasoning: z.string().describe("Detailed explanation of the score"),
  skill_match_percentage: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Percentage of required skills the candidate has"),
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
 * Schema for detect_login_fields prompt
 * Identifies username and password field selectors on login pages
 */
export const detectLoginFieldsSchema = z.object({
  usernameSelector: z
    .string()
    .nullable()
    .describe("CSS selector for username/email input field"),
  passwordSelector: z
    .string()
    .nullable()
    .describe("CSS selector for password input field"),
  submitSelector: z
    .string()
    .nullable()
    .describe("CSS selector for login/submit button"),
  confidence: z
    .number()
    .min(0.0)
    .max(1.0)
    .describe("Confidence score from 0.0 to 1.0"),
  warnings: z
    .array(z.string())
    .optional()
    .describe("Warnings (CAPTCHA, 2FA, etc)"),
});

/**
 * Schema for detect_job_detail_content prompt
 * Identifies where job details appear after clicking a job card
 */
export const detectJobDetailContentSchema = z.object({
  selector: z
    .string()
    .nullable()
    .describe("CSS selector for the job detail container"),
  confidence: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Confidence score from 0 to 100"),
  contentType: z
    .enum(["modal", "panel", "inline", "main", "unknown"])
    .describe("Type of container displaying job details"),
});

/**
 * Schema for detect_pagination prompt
 * Identifies pagination mechanisms on job listing pages
 */
export const detectPaginationSchema = z.object({
  hasPagination: z
    .boolean()
    .describe(
      "True if traditional pagination (numbered pages or next/prev buttons) is present",
    ),
  hasInfiniteScroll: z
    .boolean()
    .describe(
      "True if the page uses infinite scroll or load more buttons",
    ),
  nextButtonSelector: z
    .string()
    .optional()
    .describe("CSS selector for the Next button if pagination is present"),
  loadMoreSelector: z
    .string()
    .optional()
    .describe("CSS selector for Load More button if present"),
  paginationType: z
    .enum([
      "numbered",
      "next_prev",
      "load_more",
      "infinite_scroll",
      "none",
    ])
    .describe("The type of pagination mechanism detected"),
});

/**
 * Schema for extract_resume_data prompt
 * Extracts structured information from resume text
 */
export const extractResumeDataSchema = z.object({
  basics: z.object({
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    location: z.string().optional(),
    website: z.string().optional(),
    linkedin: z.string().optional(),
    github: z.string().optional(),
    stackoverflow: z.string().optional(),
  }),
  work: z
    .array(
      z.object({
        name: z.string(),
        position: z.string(),
        location: z.string().optional(),
        website: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        summary: z.string().optional(),
        achievements: z.array(z.string()).optional(),
        technologies: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  education: z
    .array(
      z.object({
        institution: z.string(),
        area: z.string().optional(),
        studyType: z.string().optional(),
        location: z.string().optional(),
        url: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        graduationYear: z.number().int().optional(),
      }),
    )
    .optional(),
  skills: z
    .array(
      z.object({
        name: z.string(),
        skills: z.array(
          z.object({
            name: z.string(),
            level: z
              .enum(["expert", "proficient", "intermediate", "beginner"])
              .optional(),
            yearsExperience: z.number().int().optional(),
          }),
        ),
      }),
    )
    .optional(),
  languages: z
    .array(
      z.object({
        name: z.string(),
        languageCode: z.string().optional(),
        proficiency: z
          .enum(["native", "fluent", "proficient", "conversational", "basic"])
          .optional(),
      }),
    )
    .optional(),
  projects: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().optional(),
        summary: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        achievements: z.array(z.string()).optional(),
        technologies: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  references: z
    .array(
      z.object({
        author: z.string(),
        authorPosition: z.string().optional(),
        text: z.string(),
      }),
    )
    .optional(),
});

/**
 * Schema for extract_jobs_from_search_page prompt
 * Extracts job information from search results page (SPA click-scraper)
 */
export const extractJobsFromSearchPageSchema = z.object({
  jobs: z.array(
    z.object({
      clickableId: z.number().int().describe(
        "EXACT data-extract-clickable-id from HTML - do not invent",
      ),
      title: z.string().nullable().describe("Job title/position name"),
      company: z.string().nullable().describe("Company or employer name"),
      location: z.string().nullable().describe(
        "Job location (city, region, country)",
      ),
      salary_min: z.number().nullable().describe(
        "Minimum salary as numeric value only",
      ),
      salary_max: z.number().nullable().describe(
        "Maximum salary as numeric value only",
      ),
      salary_currency: z.string().nullable().describe(
        "Currency code (USD, EUR, GBP, etc.)",
      ),
      salary_period: z.string().nullable().describe(
        "Salary period (year, month, hour, day)",
      ),
      skills: z.array(z.string()).nullable().describe(
        "Array of skills/technologies/tools mentioned",
      ),
      remote: z.string().nullable().describe(
        "Work arrangement (Remote, Hybrid, On-site)",
      ),
      date_posted: z.string().nullable().describe(
        "Date posted - preserve original format from HTML",
      ),
    }),
  ),
  pattern: z.string().describe(
    "Description of the extraction pattern or strategy used",
  ),
  jobCount: z.number().int().describe("Total number of jobs extracted"),
});

/**
 * Schema for classify_clickables prompt
 * Classifies clickable elements as view-details or action buttons
 */
export const classifyClickablesSchema = z.object({
  clickables: z.array(
    z.object({
      id: z.number().int().describe("The data-extract-clickable-id value"),
      type: z
        .enum(["view-details", "action"])
        .describe("Clickable classification"),
    }),
  ),
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
  extract_job_links: extractJobLinksSchema,
  extract_job_data: extractJobDataSchema,
  extract_job_data_browser_use: extractJobDataBrowserUseSchema,
  extract_jobs_from_search_page: extractJobsFromSearchPageSchema,
  score_job_match: scoreJobMatchSchema,
  detect_login_page: detectLoginPageSchema,
  detect_login_fields: detectLoginFieldsSchema,
  detect_job_detail_content: detectJobDetailContentSchema,
  detect_pagination: detectPaginationSchema,
  extract_resume_data: extractResumeDataSchema,
  classify_clickables: classifyClickablesSchema,
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
