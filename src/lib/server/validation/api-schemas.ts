import { z } from "zod";
import { error as httpError } from "@sveltejs/kit";

const trimmedString = (maxLen = 255) => z.string().trim().max(maxLen);

const requiredTrimmedString = (field: string, maxLen = 255) =>
  z.string().trim().min(1, `${field} is required`).max(maxLen);

const optionalTrimmedString = (maxLen = 255) =>
  trimmedString(maxLen).optional().nullable();

const positiveInt = () => z.number().int().positive();

const httpUrl = (field: string) =>
  z.string().trim().refine(
    (val) => !val || val.startsWith("http"),
    { message: `${field} must be a valid URL` },
  );

// Interview stories

export const interviewStoryCreateSchema = z.object({
  profile_id: positiveInt(),
  title: requiredTrimmedString("Title"),
  category: optionalTrimmedString(),
  situation: optionalTrimmedString(10000),
  task: optionalTrimmedString(10000),
  action: optionalTrimmedString(10000),
  result: optionalTrimmedString(10000),
  reflection: optionalTrimmedString(10000),
});

export const interviewStoryUpdateSchema = interviewStoryCreateSchema.extend({
  id: positiveInt(),
});

export const interviewStoryDeleteSchema = z.object({
  profile_id: positiveInt(),
  id: positiveInt(),
});

export const interviewStoryReorderSchema = z.object({
  profile_id: positiveInt(),
  order: z.array(positiveInt()),
});

// Cheat sheets

export const cheatSheetCreateSchema = z.object({
  profile_id: positiveInt(),
  title: requiredTrimmedString("Title"),
  content: optionalTrimmedString(50000),
});

export const cheatSheetUpdateSchema = cheatSheetCreateSchema.extend({
  id: positiveInt(),
});

export const cheatSheetDeleteSchema = z.object({
  profile_id: positiveInt(),
  id: positiveInt(),
});

export const cheatSheetReorderSchema = z.object({
  profile_id: positiveInt(),
  order: z.array(positiveInt()),
});

// Languages

export const languageReorderSchema = z.object({
  profile_id: positiveInt(),
  order: z.array(positiveInt()),
});

// References

export const referenceReorderSchema = z.object({
  profile_id: positiveInt(),
  order: z.array(positiveInt()),
});

// Certificates

export const certificateReorderSchema = z.object({
  profile_id: positiveInt(),
  order: z.array(positiveInt()),
});

// Job preferences

export const jobPreferencesSchema = z.object({
  profile_id: positiveInt(),
  job_types: z.array(z.string()).min(1, "Please select at least one job type"),
  experience_levels: z.array(z.string()).optional().nullable(),
  work_location: z.array(z.string()).min(
    1,
    "Please select at least one work location option",
  ),
  locations: z.array(z.string()).optional().nullable(),
  remote_only: z.boolean().optional(),
  match_community_jobs: z.boolean().optional(),
  community_max_age_days: z.number().int().positive().nullable().optional(),
});

export const jobPreferencesPatchSchema = z.object({
  profile_id: positiveInt(),
  job_types: z.array(z.string()).min(1, "Please select at least one job type")
    .optional(),
  experience_levels: z.array(z.string()).optional().nullable(),
  work_location: z.array(z.string()).min(
    1,
    "Please select at least one work location option",
  ).optional(),
  locations: z.array(z.string()).optional().nullable(),
  remote_only: z.boolean().optional(),
  match_community_jobs: z.boolean().optional(),
  community_max_age_days: z.number().int().positive().nullable().optional(),
});

// Platform create

export const platformCreateSchema = z.object({
  url: requiredTrimmedString("URL", 2048),
  name: optionalTrimmedString(),
  loginPageUrl: optionalTrimmedString(2048),
});

// Platform credentials

export const platformCredentialsSchema = z.object({
  profileId: z.union([
    positiveInt(),
    z.string().regex(/^\d+$/).transform(Number),
  ]),
  credentialId: z.union([
    positiveInt(),
    z.string().regex(/^\d+$/).transform(Number),
  ]).optional(),
  username: optionalTrimmedString(),
  password: optionalTrimmedString(1000),
  security_answer: optionalTrimmedString(500),
});

// Browser info

export const browserInfoSchema = z.object({
  force: z.boolean().optional(),
  browser_language: z.string().max(50).optional().nullable(),
  browser_timezone: z.string().max(100).optional().nullable(),
});

// Job search update

const newCredentialSchema = z.object({
  username: requiredTrimmedString("Username"),
  password: optionalTrimmedString(1000),
});

export const searchTaskUpdateSchema = z.object({
  note: trimmedString().max(500).optional().nullable(),
  search_url: httpUrl("search_url").optional().nullable(),
  search_term: z.string().max(500).optional().nullable(),
  search_location: z.string().max(500).optional().nullable(),
  search_filters: z.record(
    z.string(),
    z.union([z.string(), z.array(z.string())]),
  ).optional(),
  is_active: z.boolean().optional(),
  platform_id: z.union([z.null(), z.number().int()]).optional(),
  max_jobs: z.union([
    z.null(),
    z.number().int().positive("max_jobs must be a positive integer"),
    z.string().regex(/^\d+$/).transform(Number).pipe(
      z.number().int().positive("max_jobs must be a positive integer"),
    ),
  ]).optional(),
  skip_existing: z.boolean().optional(),
  stop_after_duplicates: z.union([
    z.null(),
    z.number().int().min(1, "stop_after_duplicates must be at least 1"),
    z.string().regex(/^\d+$/).transform(Number).pipe(
      z.number().int().min(1, "stop_after_duplicates must be at least 1"),
    ),
  ]).optional(),
  skip_first: z.union([
    z.null(),
    z.number().int().min(1, "skip_first must be at least 1"),
    z.string().regex(/^\d+$/).transform(Number).pipe(
      z.number().int().min(1, "skip_first must be at least 1"),
    ),
  ]).optional(),
  new_credential: newCredentialSchema.optional(),
  /** ID of a `platform_credentials` row (user-wide). Null clears the
   *  credential on the task. The endpoint resolves a per-profile
   *  `platform_profiles` runtime row from this id. */
  platform_credential_id: z.union([
    z.null(),
    z.number().int(),
    z.string().regex(/^\d+$/).transform(Number),
  ]).optional(),
  login_mode: z.enum(["auto", "manual", "none"]).optional(),
  browser_provider: z.enum(["hosted", "tunnel"]).optional().nullable(),
  sjsbrowser_api_key: z.union([
    z.null(),
    z.number().int(),
  ]).optional(),
  keep_minimized: z.boolean().optional(),
  schedule_interval_hours: z.union([
    z.null(),
    z.number().int().refine((n) => [24, 48, 72, 120, 168, 336].includes(n), {
      message: "schedule_interval_hours must be 24, 48, 72, 120, 168, or 336",
    }),
  ]).optional(),
  schedule_preferred_hour: z.number().int().min(0).max(23).optional(),
  // Staff-only flag. The PATCH handler rejects this field for non-staff
  // callers so a hand-crafted request can't enable it.
  debug_screenshots: z.boolean().optional(),
});

// Platform update

export const platformUpdateSchema = z.object({
  login_page_url: httpUrl("login_page_url").optional().nullable(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "No valid fields to update" },
);

// Profile update

export const profileUpdateSchema = z.object({
  name: requiredTrimmedString("Name").optional(),
  slug: trimmedString(50).optional().nullable(),
  title: optionalTrimmedString(),
  subtitle: optionalTrimmedString(),
  headline: optionalTrimmedString(),
  summary: optionalTrimmedString(10000),
  email_address: optionalTrimmedString(),
  phone_number: optionalTrimmedString(),
  personal_website: optionalTrimmedString(),
  location: optionalTrimmedString(),
  location_url: optionalTrimmedString(),
  location_timezone: optionalTrimmedString(),
  linkedin_profile: optionalTrimmedString(),
  github_profile: optionalTrimmedString(),
  stackoverflow_profile: optionalTrimmedString(),
  npm_profile: optionalTrimmedString(),
  pypi_profile: optionalTrimmedString(),
  country_code: optionalTrimmedString(10),
  browser_language: optionalTrimmedString(50),
  browser_timezone: optionalTrimmedString(100),
  browser_country_code: z.string().trim().toUpperCase()
    .refine((val) => !val || /^[A-Z]{2}$/.test(val), {
      message: "browser_country_code must be a 2-letter country code",
    }).optional().nullable(),
});

// Education update

export const educationUpdateSchema = z.object({
  institution: requiredTrimmedString("Institution").optional(),
  area: optionalTrimmedString(),
  study_type: optionalTrimmedString(),
  location: optionalTrimmedString(),
  url: optionalTrimmedString(2048),
  graduation_year: z.union([
    z.number().int(),
    z.string().regex(/^\d+$/).transform(Number),
  ]).optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  summary: optionalTrimmedString(10000),
  tags: z.array(z.string()).optional().nullable(),
});

// Work experience update

export const workExperienceBasicSchema = z.object({
  section: z.literal("basic").optional(),
  name: requiredTrimmedString("Company name").optional(),
  position: requiredTrimmedString("Position").optional(),
  location: optionalTrimmedString(),
  website: optionalTrimmedString(2048),
  headline: optionalTrimmedString(255),
  summary: optionalTrimmedString(10000),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
});

export const workExperienceTechSchema = z.object({
  section: z.literal("technologies"),
  // Accept either bare names (legacy) or {name, tags} so per-technology
  // version tags survive the save round-trip.
  technologies: z.array(
    z.union([
      z.string(),
      z.object({
        name: z.string(),
        tags: z.array(z.string()).optional().nullable(),
      }),
    ]),
  ),
});

export const workExperienceAchievementsSchema = z.object({
  section: z.literal("achievements"),
  achievements: z.array(z.object({
    // Present for existing rows so the id survives a save (stable across edits
    // → translations keyed by it don't orphan); absent for newly-added ones.
    id: z.number().int().optional(),
    description: z.string(),
    tags: z.array(z.string()).optional().nullable(),
  })),
});

export const workExperienceProjectsSchema = z.object({
  section: z.literal("projects"),
  // The full ordered list of projects for this work experience. Existing rows
  // carry their `id` so it survives a save (keeps the row — and its
  // technologies — stable); newly-added ones omit it.
  projects: z.array(z.object({
    id: z.number().int().optional(),
    name: z.string(),
    url: optionalTrimmedString(2048),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    description: optionalTrimmedString(10000),
    outcome: optionalTrimmedString(10000),
    technologies: z.array(z.string()).optional().default([]),
  })),
});

// Side project update

export const sideProjectBasicSchema = z.object({
  section: z.literal("basic").optional(),
  name: requiredTrimmedString("Project name").optional(),
  url: optionalTrimmedString(2048),
  url_label: optionalTrimmedString(),
  summary: optionalTrimmedString(10000),
  stars: z.number().int().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
});

export const sideProjectTechSchema = z.object({
  section: z.literal("technologies"),
  technologies: z.array(z.string()),
});

export const sideProjectAchievementsSchema = z.object({
  section: z.literal("achievements"),
  achievements: z.array(z.object({
    // See workExperienceAchievementsSchema — stable id across saves.
    id: z.number().int().optional(),
    description: z.string(),
  })),
});

// Shared validation helper

/**
 * Parse and validate request body. Throws SvelteKit error(400) on failure.
 * Use in routes that throw errors (error() pattern).
 */
export function parseBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    httpError(400, formatZodError(result.error));
  }
  return result.data;
}

// --- AI generation schemas ---

/**
 * Body of the two "start an AI turn" endpoints. `instructions` is the
 * applicant's own brief for this turn, typed in the editor's composer; absent
 * or blank runs the prompt exactly as it did before briefs existed.
 */
export const letterGenerateSchema = z.object({
  instructions: z.string().trim().max(5000).optional(),
  mode: z.enum(["generate", "advice", "review", "auto"]).optional().default(
    "generate",
  ),
});

export const questionGenerateSchema = z.object({
  instructions: z.string().trim().max(5000).optional(),
  mode: z.enum(["generate", "advice", "review", "auto"]).optional().default(
    "generate",
  ),
  /** Draft flow: generate into the thread without writing the answer column. */
  commit: z.boolean().optional().default(true),
});

/** Body of the STAR-story "start an AI turn" endpoint (see questionGenerateSchema). */
export const storyGenerateSchema = z.object({
  instructions: z.string().trim().max(5000).optional(),
  mode: z.enum(["generate", "advice", "review", "auto"]).optional().default(
    "generate",
  ),
});

export const followupRequestSchema = z.object({
  followupRequest: requiredTrimmedString("Follow-up request", 5000),
  includeOriginalContext: z.boolean().optional().default(false),
  updateContent: z.boolean().optional().default(false),
  mode: z.enum(["feedback", "review"]).optional(),
  replaceVersionId: z.number().int().positive().optional(),
});

// Personal AI agent chat

export const agentChatSchema = z.object({
  profile_id: positiveInt(),
  // Existing thread to append to; omitted/null starts a new conversation.
  conversation_id: positiveInt().optional().nullable(),
  // The user's newest message. Prior turns are loaded server-side from the
  // conversation, so the client only sends what's new.
  message: z.string().trim().min(1).max(8000),
  // Optional snapshot of what the user is looking at, supplied by the page.
  pageContext: z
    .object({
      label: trimmedString(200).optional(),
      data: z.unknown().optional(),
    })
    .optional()
    .nullable(),
});

/**
 * Format Zod error into a human-readable message.
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((e) => {
      const path = e.path.join(".");
      return path ? `${path}: ${e.message}` : e.message;
    })
    .join("; ");
}
