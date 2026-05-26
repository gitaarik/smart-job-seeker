export interface SettingsExportData {
  version: "1.0";
  exported_at: string;
  scope: "settings";
  search_tasks?: ExportedSearchTask[];
  match_config?: ExportedMatchConfig;
  email_digest?: ExportedEmailDigest;
  salary?: ExportedSalary;
}

export interface ExportedSearchTask {
  // FK targets travel by platform key (job_platforms.key is unique).
  // On import, platform_profile_id is auto-linked from the target profile's
  // existing credential for that platform (a profile has at most one
  // platform_profile per platform), or left null if none is configured.
  platform_key: string | null;

  search_url: string | null;
  navigation_type: string | null;
  stripped_html: string | null;
  is_active: boolean;
  max_jobs: number | null;
  browser_provider: string | null;
  search_term: string | null;
  skip_existing: boolean;
  skip_first: number | null;
  stop_after_duplicates: number | null;
  keep_minimized: boolean | null;
  ui_preferences: unknown;
  note: string | null;
  schedule_interval_hours: number | null;
  schedule_preferred_hour: number | null;
  login_mode: string;
  search_location: string | null;
  search_filters: Record<string, string | string[]>;
  debug_screenshots: boolean;
}

export interface ExportedMatchConfig {
  name: string | null;
  job_types: unknown;
  experience_levels: unknown;
  work_location: unknown;
  locations: unknown;
  match_community_jobs: boolean;
  remote_only: boolean;
  community_max_age_days: number | null;
}

export interface ExportedEmailDigest {
  enabled: boolean;
  frequency_days: number | null;
  min_score: number | null;
  preferred_hour: number | null;
  send_to: string | null;
}

export interface ExportedSalary {
  base_rate: number | null;
  currency: string | null;
  adjustments: unknown;
  region_overrides: unknown;
  expectations: ExportedSalaryExpectation[];
}

export interface ExportedSalaryExpectation {
  sort: number | null;
  job_title: string | null;
  company_type: string;
  employment_type: string;
  work_arrangement: string;
  region: string;
  hourly_rate: number | null;
  month_salary: number | null;
  year_salary: number | null;
  daily_rate: number | null;
  currency: string | null;
  experience_level: string | null;
}
