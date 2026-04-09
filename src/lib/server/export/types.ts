/**
 * Export/Import Type Definitions
 */

// Export scope options
export type ExportScope = "profile" | "full";

// Export format options
export type ExportFormat = "json" | "zip";

// Export options passed to export functions
export interface ExportOptions {
  scope: ExportScope;
  includeMedia: boolean;
}

// Media file reference in export
export interface MediaFile {
  /** Original path in uploads directory */
  path: string;
  /** Path in export archive (media/...) */
  archivePath: string;
  /** Entity type this media belongs to */
  entityType: "profile" | "work_experience" | "education" | "side_project";
  /** Entity ID */
  entityId: number;
  /** Field name (e.g., "profile_photo_path", "logo_path") */
  field: string;
}

// Base export envelope
export interface ExportEnvelope {
  /** Export format version */
  version: "2.0";
  /** ISO timestamp of export */
  exported_at: string;
  /** What scope was exported */
  scope: ExportScope;
  /** Whether media files are included */
  has_media: boolean;
  /** Media file manifest (only if has_media) */
  media_files?: MediaFile[];
}

// Profile data (resume/CV/portfolio)
export interface ExportedProfileData {
  // Basic info
  name?: string;
  title?: string;
  slug?: string;
  location?: string;

  // Contact
  phone_number?: string;
  email_address?: string;
  personal_website?: string;

  // Social profiles
  linkedin_profile?: string;
  github_profile?: string;
  stackoverflow_profile?: string;
  npm_profile?: string;
  pypi_profile?: string;
  signal_profile?: string;
  whatsapp_number?: string;
  telegram_username?: string;

  // Professional info
  subtitle?: string;
  core_stack?: string;
  headline?: string;
  summary?: string;
  about_me_text?: string;
  nationality?: string;
  location_url?: string;
  location_timezone?: string;
  meta_image_url?: string;

  // Experience years
  dev_start_year?: number | null;
  python_js_start_year?: number | null;
  remote_start_year?: number | null;

  // Business info
  company_name?: string;
  street_address?: string;
  postal_code?: string;
  vat_id?: string;
  kvk_number?: string;

  // Media paths
  profile_photo_path?: string;

  // Related data
  profile_versions: ExportedProfileVersion[];
  highlights: ExportedHighlight[];
  tech_skill_categories: ExportedTechSkillCategory[];
  work_experiences: ExportedWorkExperience[];
  side_projects: ExportedSideProject[];
  education: ExportedEducation[];
  languages: ExportedLanguage[];
  references: ExportedReference[];
  certificates: ExportedCertificate[];
}

export interface ExportedProfileVersion {
  status?: string;
  sort?: number | null;
  slug?: string;
  name?: string;
  /** @deprecated Legacy field from old format (was display name). Kept for backward-compatible imports. */
  description?: string;
  toggles?: unknown;
  extends_from?: string | null;
}

export interface ExportedHighlight {
  status?: string;
  sort?: number | null;
  text?: string;
  fa_icon?: string;
}

export interface ExportedTechSkillCategory {
  status?: string;
  sort?: number | null;
  name?: string;
  fa_icon?: string;
  tech_skills: ExportedTechSkill[];
}

export interface ExportedTechSkill {
  status?: string;
  sort?: number | null;
  name?: string;
  years_experience?: string;
  level?: string;
  tech_type?: string | null;
}

export interface ExportedWorkExperience {
  name?: string;
  location?: string;
  position?: string;
  summary?: string;
  status?: string;
  sort?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  website?: string;
  tags?: unknown;
  logo_path?: string;
  achievements: ExportedWorkExperienceAchievement[];
  technologies: ExportedWorkExperienceTechnology[];
  projects: ExportedWorkExperienceProject[];
}

export interface ExportedWorkExperienceAchievement {
  status?: string;
  sort?: number | null;
  title?: string;
  description?: string;
  fa_icon?: string;
  tags?: unknown;
}

export interface ExportedWorkExperienceTechnology {
  status?: string;
  sort?: number | null;
  name?: string;
}

export interface ExportedWorkExperienceProject {
  status?: string;
  sort?: number | null;
  name: string;
  url?: string;
  start_date?: string | null;
  end_date?: string | null;
  description?: string;
  outcome?: string;
  technologies: ExportedWorkExperienceProjectTechnology[];
}

export interface ExportedWorkExperienceProjectTechnology {
  sort?: number | null;
  name?: string;
}

export interface ExportedSideProject {
  status?: string;
  sort?: number | null;
  name?: string;
  start_date?: string | null;
  end_date?: string | null;
  url?: string;
  stars?: number | null;
  summary?: string;
  url_label?: string;
  image_path?: string;
  tags?: unknown;
  achievements: ExportedSideProjectAchievement[];
  technologies: ExportedSideProjectTechnology[];
}

export interface ExportedSideProjectAchievement {
  description?: string;
  sort?: number | null;
}

export interface ExportedSideProjectTechnology {
  sort?: number | null;
  name?: string;
}

export interface ExportedEducation {
  status?: string;
  sort?: number | null;
  institution?: string;
  location?: string;
  url?: string;
  area?: string;
  study_type?: string;
  graduation_year?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  summary?: string;
  logo_path?: string;
  tags?: unknown;
}

export interface ExportedLanguage {
  status?: string;
  sort?: number | null;
  name?: string;
  language_code?: string;
  proficiency?: string;
}

export interface ExportedCertificate {
  status?: string;
  sort?: number | null;
  name?: string;
  issuer?: string;
  date?: string | null;
  url?: string;
}

export interface ExportedReference {
  status?: string;
  sort?: number | null;
  author?: string;
  author_position?: string;
  text?: string;
}

// Full account additional data
export interface ExportedProjectStory {
  sort?: number | null;
  title?: string;
  situation?: string;
  task?: string;
  action?: string;
  result?: string;
  reflection?: string;
  category?: string;
}

export interface ExportedCheatSheet {
  sort?: number | null;
  title?: string;
  content?: string;
}

/** @deprecated Legacy format — kept for backward-compatible imports */
export interface ExportedSalaryExpectation {
  sort?: number | null;
  job_title?: string;
  company_type?: string;
  employment_type?: string;
  work_arrangement?: string;
  experience_level?: string;
  region?: string;
  hourly_rate?: number | null;
  month_salary?: number | null;
  year_salary?: number | null;
  daily_rate?: number | null;
}

export interface ExportedSalarySettings {
  base_rate?: number | null;
  currency?: string;
  adjustments?: Record<string, Record<string, number>>;
  region_overrides?: Record<string, number>;
}

export interface ExportedJobPreferences {
  // Job matching preferences
  preferred_roles?: string[];
  preferred_locations?: string[];
  remote_preference?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  // Add more as needed based on actual schema
}

export interface ExportedSavedJob {
  job_id: number;
  source_url?: string;
  title?: string;
  company?: string;
  saved_at?: string;
}

export interface ExportedJobMatch {
  job_id: number;
  source_url?: string;
  title?: string;
  company?: string;
  match_score?: number;
  matched_at?: string;
}

export interface ExportedApplication {
  status?: string;
  job_title?: string;
  company?: string;
  source_url?: string;
  application_sent_date?: string;
  application_note?: string;
  salary_expectation?: number;
  salary_currency?: string;
  salary_period?: string;
  letters?: ExportedApplicationLetter[];
  questions?: ExportedApplicationQuestion[];
}

export interface ExportedApplicationLetter {
  type?: string;
  content?: string;
}

export interface ExportedApplicationQuestion {
  question?: string;
  answer?: string;
}

// Complete export data structure
export interface ProfileExportData extends ExportEnvelope {
  scope: "profile";
  profile: ExportedProfileData;
}

export interface FullExportData extends ExportEnvelope {
  scope: "full";
  profile: ExportedProfileData;
  project_stories: ExportedProjectStory[];
  cheat_sheets: ExportedCheatSheet[];
  salary_settings?: ExportedSalarySettings;
  /** @deprecated Legacy format — kept for backward-compatible imports */
  salary_expectations?: ExportedSalaryExpectation[];
  job_preferences?: ExportedJobPreferences;
  saved_jobs?: ExportedSavedJob[];
  job_matches?: ExportedJobMatch[];
  applications?: ExportedApplication[];
}

export type ExportData = ProfileExportData | FullExportData;
