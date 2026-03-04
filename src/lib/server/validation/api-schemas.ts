import { z } from "zod";
import { error as httpError } from "@sveltejs/kit";

const trimmedString = (maxLen = 255) =>
  z.string().trim().max(maxLen);

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

// Job preferences

export const jobPreferencesSchema = z.object({
  profile_id: positiveInt(),
  job_types: z.array(z.string()).min(1, "Please select at least one job type"),
  experience_levels: z.array(z.string()).optional().nullable(),
  work_location: z.array(z.string()).min(1, "Please select at least one work location option"),
  locations: z.array(z.string()).optional().nullable(),
});

// Platform create

export const platformCreateSchema = z.object({
  url: requiredTrimmedString("URL", 2048),
  name: optionalTrimmedString(),
  loginPageUrl: optionalTrimmedString(2048),
});

// Platform credentials

export const platformCredentialsSchema = z.object({
  profileId: z.union([positiveInt(), z.string().regex(/^\d+$/).transform(Number)]),
  username: optionalTrimmedString(),
  password: optionalTrimmedString(1000),
});

// Browser info

export const browserInfoSchema = z.object({
  force: z.boolean().optional(),
  browser_user_agent: z.string().max(500).optional().nullable(),
  browser_language: z.string().max(50).optional().nullable(),
  browser_timezone: z.string().max(100).optional().nullable(),
});

// Job search update

const newCredentialSchema = z.object({
  username: requiredTrimmedString("Username"),
  password: optionalTrimmedString(1000),
});

export const jobSearchUpdateSchema = z.object({
  search_url: httpUrl("search_url").optional().nullable(),
  max_jobs: z.union([
    z.null(),
    z.number().int().positive("max_jobs must be a positive integer"),
    z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive("max_jobs must be a positive integer")),
  ]).optional(),
  new_credential: newCredentialSchema.optional(),
  platform_profile_id: z.union([
    z.null(),
    z.number().int(),
    z.string().regex(/^\d+$/).transform(Number),
  ]).optional(),
  browser_country_code: z.string().trim().toUpperCase()
    .refine((val) => !val || /^[A-Z]{2}$/.test(val), {
      message: "browser_country_code must be a 2-letter country code",
    }).optional().nullable(),
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
  linkedin_profile: optionalTrimmedString(),
  github_profile: optionalTrimmedString(),
  stackoverflow_profile: optionalTrimmedString(),
  npm_profile: optionalTrimmedString(),
  pypi_profile: optionalTrimmedString(),
  country_code: optionalTrimmedString(10),
  browser_user_agent: optionalTrimmedString(500),
  browser_language: optionalTrimmedString(50),
  browser_timezone: optionalTrimmedString(100),
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
});

// Work experience update

export const workExperienceBasicSchema = z.object({
  section: z.literal("basic").optional(),
  name: requiredTrimmedString("Company name").optional(),
  position: requiredTrimmedString("Position").optional(),
  location: optionalTrimmedString(),
  website: optionalTrimmedString(2048),
  summary: optionalTrimmedString(10000),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
});

export const workExperienceTechSchema = z.object({
  section: z.literal("technologies"),
  technologies: z.array(z.string()),
});

export const workExperienceAchievementsSchema = z.object({
  section: z.literal("achievements"),
  achievements: z.array(z.string()),
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
});

export const sideProjectTechSchema = z.object({
  section: z.literal("technologies"),
  technologies: z.array(z.string()),
});

export const sideProjectAchievementsSchema = z.object({
  section: z.literal("achievements"),
  achievements: z.array(z.string()),
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
