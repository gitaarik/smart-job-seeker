import {
  type AnyPgColumn,
  bigint,
  boolean,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  json,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  type PgTableExtraConfigValue,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const Role = pgEnum("Role", ["USER", "ADMIN", "SUPER_ADMIN"]);

export const ai_chats_id_seq = pgSequence("ai_chats_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const ai_chats_id_seq1 = pgSequence("ai_chats_id_seq1", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const ai_chats_id_seq2 = pgSequence("ai_chats_id_seq2", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const ai_chats_id_seq3 = pgSequence("ai_chats_id_seq3", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const application_activity_log_id_seq = pgSequence(
  "application_activity_log_id_seq",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const application_activity_log_id_seq1 = pgSequence(
  "application_activity_log_id_seq1",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const application_activity_log_id_seq2 = pgSequence(
  "application_activity_log_id_seq2",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const application_activity_log_id_seq3 = pgSequence(
  "application_activity_log_id_seq3",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const application_letters_id_seq = pgSequence(
  "application_letters_id_seq",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const application_letters_id_seq1 = pgSequence(
  "application_letters_id_seq1",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const application_letters_id_seq2 = pgSequence(
  "application_letters_id_seq2",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const application_letters_id_seq3 = pgSequence(
  "application_letters_id_seq3",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const application_questions_id_seq = pgSequence(
  "application_questions_id_seq",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const application_questions_id_seq1 = pgSequence(
  "application_questions_id_seq1",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const application_questions_id_seq2 = pgSequence(
  "application_questions_id_seq2",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const application_questions_id_seq3 = pgSequence(
  "application_questions_id_seq3",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const application_questions_id_seq4 = pgSequence(
  "application_questions_id_seq4",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const applications_files_id_seq = pgSequence(
  "applications_files_id_seq",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const applications_files_id_seq1 = pgSequence(
  "applications_files_id_seq1",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const applications_files_id_seq2 = pgSequence(
  "applications_files_id_seq2",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const applications_files_id_seq3 = pgSequence(
  "applications_files_id_seq3",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const applications_id_seq = pgSequence("applications_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const applications_id_seq1 = pgSequence("applications_id_seq1", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const applications_id_seq2 = pgSequence("applications_id_seq2", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const applications_id_seq3 = pgSequence("applications_id_seq3", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const cheat_sheets_id_seq = pgSequence("cheat_sheets_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const config_id_seq = pgSequence("config_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const config_id_seq1 = pgSequence("config_id_seq1", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const config_id_seq2 = pgSequence("config_id_seq2", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const config_id_seq3 = pgSequence("config_id_seq3", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const dev_methodologies_id_seq = pgSequence("dev_methodologies_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const job_matches_id_seq = pgSequence("job_matches_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const job_matches_id_seq1 = pgSequence("job_matches_id_seq1", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const job_matches_id_seq2 = pgSequence("job_matches_id_seq2", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const job_matches_id_seq3 = pgSequence("job_matches_id_seq3", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const job_resources_id_seq = pgSequence("job_resources_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const job_resources_id_seq1 = pgSequence("job_resources_id_seq1", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const job_resources_id_seq2 = pgSequence("job_resources_id_seq2", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const job_resources_id_seq3 = pgSequence("job_resources_id_seq3", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
/**
 * `highlights.id` defaults to `nextval('highlights_id_seq')`, and this is the
 * declaration that says the sequence exists.
 *
 * It was the ONE sequence referenced by a default and never declared — which is
 * how a from-scratch build died on `CREATE TABLE "highlights"` referring to a
 * sequence nothing had created. Likely collateral from working around
 * `drizzle-kit push` wanting to `DROP SEQUENCE highlights_id_seq`: push wants
 * to drop what the schema does not claim, so removing the declaration silenced
 * push and left the schema unable to describe itself.
 */
export const highlights_id_seq = pgSequence("highlights_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const jobs_id_seq = pgSequence("jobs_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const jobs_id_seq1 = pgSequence("jobs_id_seq1", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const jobs_id_seq2 = pgSequence("jobs_id_seq2", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const jobs_id_seq3 = pgSequence("jobs_id_seq3", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const languages_id_seq = pgSequence("languages_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const profile_exports_id_seq = pgSequence("profile_exports_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const profile_exports_id_seq1 = pgSequence("profile_exports_id_seq1", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const profile_exports_id_seq2 = pgSequence("profile_exports_id_seq2", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const profile_exports_id_seq3 = pgSequence("profile_exports_id_seq3", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const profile_tokens_id_seq = pgSequence("profile_tokens_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const profile_tokens_id_seq1 = pgSequence("profile_tokens_id_seq1", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const profile_tokens_id_seq2 = pgSequence("profile_tokens_id_seq2", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const profile_tokens_id_seq3 = pgSequence("profile_tokens_id_seq3", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const project_stories_id_seq = pgSequence("project_stories_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const side_project_achievements_id_seq = pgSequence(
  "side_project_achievements_id_seq",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const soft_skills_id_seq = pgSequence("soft_skills_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const tech_skill_categories_id_seq = pgSequence(
  "tech_skill_categories_id_seq",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const work_experience_achievements_id_seq = pgSequence(
  "work_experience_achievements_id_seq",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const work_experience_technologies_id_seq = pgSequence(
  "work_experience_technologies_id_seq",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);

export const ai_chat_templates = pgTable("ai_chat_templates", {
  id: serial().primaryKey().notNull(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  key: varchar({ length: 255 }).notNull(),
  system_prompt: text(),
  user_prompt: text(),
  format: json(),
}, (table) => [
  unique("ai_chat_templates_key_key").on(table.key),
]);

export const ai_prompts = pgTable("ai_prompts", {
  id: uuid().primaryKey().notNull(),
  sort: integer(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  name: varchar({ length: 255 }),
  status: varchar({ length: 255 }).default("draft"),
  description: text(),
  system_prompt: text(),
  messages: json(),
}, (table) => [
  index().using("btree", table.name.asc().nullsLast()),
  uniqueIndex("ai_prompts_name_unique").using(
    "btree",
    table.name.asc().nullsLast(),
  ),
]);

export const collected_data = pgTable("collected_data", {
  id: serial().primaryKey().notNull(),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  schema: text(),
  data: text(),
  profile_id: integer(),
}, (table) => [
  index("collected_data_profile_updated_idx").on(
    table.profile_id,
    table.date_updated.desc(),
  ),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "collected_data_profile_foreign",
  }).onDelete("cascade"),
]);

export const config = pgTable("config", {
  id: serial().primaryKey().notNull(),
  default_profile: integer(),
}, (table) => [
  foreignKey({
    columns: [table.default_profile],
    foreignColumns: [profiles.id],
    name: "config_default_profile_foreign",
  }).onDelete("set null"),
]);

// Singleton (id = 1) holding the latest currency exchange rates, refreshed by
// the worker's FX job. This row is the single source of truth for salary
// currency conversion; when it's absent, comparisons degrade to "unknown"
// rather than guessing. See cloud/src/worker.ts refreshFxRates().
export const fx_rates = pgTable("fx_rates", {
  id: integer().primaryKey().notNull(),
  base: varchar({ length: 10 }).default("EUR").notNull(),
  rates: jsonb().notNull(),
  updated_at: timestamp({ withTimezone: true, mode: "date" }).notNull(),
});

// Cached embeddings for the bounded skill vocabulary (semantic skill matching).
// Keyed by the normalized skill string (output of normalizeSkill) so casing /
// separator variants share one row. Vector stored as jsonb (number[]) — the
// vocab is small enough to load into memory and cosine-compare in JS, so no
// pgvector dependency here. `model` lets us invalidate when the embedding model
// changes (different models produce incomparable vectors).
export const skill_embeddings = pgTable("skill_embeddings", {
  skill: varchar({ length: 255 }).primaryKey().notNull(),
  label: varchar({ length: 255 }).notNull(),
  embedding: jsonb().notNull(),
  model: varchar({ length: 100 }).notNull(),
  created_at: timestamp({ withTimezone: true, mode: "date" })
    .default(sql`now()`)
    .notNull(),
});

export const education = pgTable("education", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("draft").notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  institution: varchar({ length: 255 }),
  location: varchar({ length: 255 }),
  url: varchar({ length: 255 }),
  area: varchar({ length: 255 }),
  study_type: varchar({ length: 255 }),
  graduation_year: integer(),
  start_date: date(),
  end_date: date(),
  profile_id: integer().notNull(),
  summary: text(),
  logo_id: uuid(),
  tags: json(),
  logo_path: varchar({ length: 255 }),
  banner_path: varchar({ length: 255 }),
}, (table) => [
  foreignKey({
    columns: [table.logo_id],
    foreignColumns: [files.id],
    name: "education_logo_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "education_profile_foreign",
  }).onDelete("cascade"),
]);

export const highlights = pgTable("highlights", {
  id: integer().default(sql`nextval('highlights_id_seq'::regclass)`)
    .primaryKey().notNull(),
  status: varchar({ length: 255 }).default("draft").notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  profile_id: integer().notNull(),
  text: varchar({ length: 255 }),
  fa_icon: varchar({ length: 255 }),
  type: varchar({ length: 50 }).default("highlight"),
  icon_name: varchar({ length: 50 }),
}, (table) => [
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "highlights_profile_foreign",
  }).onDelete("cascade"),
]);

export const match_config = pgTable("match_config", {
  id: serial().primaryKey().notNull(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  job_types: json(),
  experience_levels: json(),
  work_location: json(),
  locations: json(),
  profile_id: integer().notNull(),
  name: varchar({ length: 255 }),
  match_community_jobs: boolean().default(false).notNull(),
  remote_only: boolean().default(false).notNull(),
  community_max_age_days: integer(),
}, (table) => [
  index("match_config_profile_id_idx").on(table.profile_id),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "match_config_profile_foreign",
  }).onDelete("cascade"),
]);

export const job_matches = pgTable("job_matches", {
  id: serial().primaryKey().notNull(),
  score: integer().default(0).notNull(),
  reasoning: text(),
  skill_match_percentage: integer(),
  strengths: json(),
  gaps: json(),
  recommendation: varchar({ length: 255 }).default("consider"),
  job_date_updated_when_matched: timestamp({
    precision: 6,
    withTimezone: true,
    mode: "date",
  }),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  job_id: integer().notNull(),
  profile_id: integer().notNull(),
  llm_prompt: text(),
  ai_chat_scoring: integer(),
  matched_skills: json(),
  match_summary: text(),
  /**
   * Set when this score is deliberately invalidated (rescrape changed the
   * job's skills, user hit re-match, staff re-parsed it). The matcher treats
   * such a row as work; `upsertJobMatch` clears it after re-scoring.
   *
   * Invalidation used to DELETE the row, which made three states
   * indistinguishable: never scored, deliberately invalidated, and lost to a
   * bug. All three read as "no row", so the matcher could not tell a genuine
   * re-match request from an accidental disappearance — and re-scoring costs
   * an LLM call each time. Keeping the row also means the UI shows the
   * previous score while the new one is computed, instead of blanking.
   */
  rescore_requested_at: timestamp({
    precision: 6,
    withTimezone: true,
    mode: "date",
  }),
}, (table) => [
  index("job_matches_ai_chat_scoring_idx").on(table.ai_chat_scoring),
  index("job_matches_profile_score_idx").on(
    table.profile_id,
    table.score.desc(),
  ),
  index("job_matches_profile_id_job_id_idx").using(
    "btree",
    table.profile_id.asc().nullsLast(),
    table.job_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.ai_chat_scoring],
    foreignColumns: [ai_chats.id],
    name: "job_matches_ai_chat_scoring_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.job_id],
    foreignColumns: [jobs.id],
    name: "job_matches_job_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "job_matches_profile_foreign",
  }).onDelete("cascade"),
]);

export const job_resources = pgTable("job_resources", {
  id: serial().primaryKey().notNull(),
  sort: integer(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  name: varchar({ length: 255 }),
  url: varchar({ length: 255 }),
  file_id: uuid(),
  job_id: integer().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.file_id],
    foreignColumns: [files.id],
    name: "job_resources_file_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.job_id],
    foreignColumns: [jobs.id],
    name: "job_resources_job_foreign",
  }).onDelete("cascade"),
]);

export const search_task_runs = pgTable("search_task_runs", {
  id: serial().primaryKey().notNull(),
  search_task_id: integer().notNull(),
  status: varchar({ length: 50 }).notNull(),
  started_at: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
  finished_at: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  jobs_found: integer(),
  error_message: text(),
  triggered_by: varchar({ length: 20 }).notNull(),
  bullmq_job_id: varchar({ length: 100 }),
  live_url: varchar({ length: 500 }),
  user_response: varchar({ length: 20 }),
  settings: jsonb(),
  verification_data: jsonb(),
  pending_action: jsonb(),
  // Device the run executed on, resolved at enqueue (own or shared). Nullable:
  // historical rows and provider-driven runs that use no device stay null.
  // Powers exact per-device footprint accounting (device-rate-budget.ts).
  api_key_id: integer(),
}, (table) => [
  index("search_task_runs_active_idx").on(table.started_at).where(
    sql`status IN ('stopping','queued','running','blocked')`,
  ),
  index("search_task_runs_search_task_id_started_at_idx").using(
    "btree",
    table.search_task_id.asc().nullsLast(),
    table.started_at.asc().nullsLast(),
  ),
  index("search_task_runs_api_key_id_started_at_idx").using(
    "btree",
    table.api_key_id.asc().nullsLast(),
    table.started_at.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.search_task_id],
    foreignColumns: [search_tasks.id],
    name: "search_task_runs_search_task_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.api_key_id],
    foreignColumns: [api_keys.id],
    name: "search_task_runs_api_key_id_fkey",
  }).onDelete("set null"),
]);

export const os_contributions = pgTable("os_contributions", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("draft").notNull(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  title: varchar({ length: 255 }),
  description: text(),
  project_name: varchar({ length: 255 }),
  profile_id: integer(),
  merged_date: date(),
  issue_url: varchar({ length: 255 }),
  pull_request_url: varchar({ length: 255 }),
  contribution_type: varchar({ length: 255 }),
}, (table) => [
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "os_contributions_profile_foreign",
  }).onDelete("cascade"),
]);

/**
 * Per-user credential for a job platform. Owned by the human, not by any
 * one profile — multiple profiles of the same user share these by default.
 * Cross-user sharing goes through `credential_shares`.
 *
 * UNIQUE (user_id, platform_id, username) lets one user maintain multiple
 * accounts on the same platform (different angles, throwaway accounts) by
 * disambiguating on username.
 *
 * Password and security_answer are stored as dotenvx-style ciphertext;
 * see lib/server/auth/crypto.ts.
 */
export const platform_credentials = pgTable("platform_credentials", {
  id: serial().primaryKey().notNull(),
  user_id: text().notNull(),
  platform_id: integer().notNull(),
  username: varchar({ length: 255 }),
  password: text(),
  api_token: text(),
  provider_profile_id: varchar({ length: 255 }),
  security_answer: text(),
  date_created: timestamp({ withTimezone: true, mode: "date" }).defaultNow(),
  date_updated: timestamp({ withTimezone: true, mode: "date" }).defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [users.id],
    name: "platform_credentials_user_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.platform_id],
    foreignColumns: [job_platforms.id],
    name: "platform_credentials_platform_fkey",
  }).onDelete("cascade"),
  uniqueIndex("platform_credentials_user_platform_username_unique").on(
    table.user_id,
    table.platform_id,
    table.username,
  ),
]);

/**
 * Per-profile runtime state for a credential's use on a platform. Holds
 * status (signup_in_progress / active / locked / ...), last_login_at, and
 * the most recent login_error. The credential itself lives on
 * `platform_credentials`, joined via `platform_credential_id`.
 */
export const platform_profiles = pgTable("platform_profiles", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("signup_in_progress").notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  profile_id: integer().notNull(),
  platform_id: integer(),
  platform_credential_id: integer(),
  last_login_at: timestamp({ withTimezone: true, mode: "date" }),
  login_error: text(),
}, (table) => [
  foreignKey({
    columns: [table.platform_id],
    foreignColumns: [job_platforms.id],
    name: "platform_profiles_platform_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "platform_profiles_profile_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.platform_credential_id],
    foreignColumns: [platform_credentials.id],
    name: "platform_profiles_credential_fkey",
  }).onDelete("set null"),
]);

export const languages = pgTable("languages", {
  id: integer().default(sql`nextval('languages_id_seq'::regclass)`).primaryKey()
    .notNull(),
  status: varchar({ length: 255 }).default("draft").notNull(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  name: varchar({ length: 255 }),
  language_code: varchar({ length: 255 }),
  proficiency: varchar({ length: 255 }),
  profile_id: integer().notNull(),
  sort: integer(),
}, (table) => [
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "languages_profile_foreign",
  }).onDelete("cascade"),
]);

export const job_platforms = pgTable("job_platforms", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("draft").notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  name: varchar({ length: 255 }).notNull(),
  url: varchar({ length: 255 }).notNull(),
  type: varchar({ length: 255 }),
  key: varchar({ length: 255 }).notNull(),
  login_page_url: varchar({ length: 255 }),
  /** Direct URL to the platform's search entry page (the page that hosts
   *  the keyword input + initial filter UI). Used by the search-form
   *  scraper to navigate before identifying form fields. Falls back to
   *  the platform's `url` when null. Example: LinkedIn's would be
   *  `https://www.linkedin.com/jobs/`. */
  search_page_url: varchar({ length: 512 }),
  // Phase 1 usage signals — incremented when a search_task_run on this
  // platform reaches a terminal state. See planning/JOB-PLATFORM-SIGNALS.md
  // for the full multi-phase plan.
  success_count: integer().default(0).notNull(),
  failure_count: integer().default(0).notNull(),
  last_success_at: timestamp({ withTimezone: true, mode: "date" }),
  last_failure_at: timestamp({ withTimezone: true, mode: "date" }),
  // Aggregated record of which canonical (filter, value_key) pairs the
  // scraper has *tried* to apply on this platform but failed to find on
  // the search form. Merged (union) on every run; never cleared
  // automatically. The suggest endpoint feeds this to the LLM so it can
  // soft-deprioritize platforms whose missing filters overlap the user's
  // preferences. Keys are SearchFilterName, values are arrays of canonical
  // value_keys observed-as-missing.
  unsupported_filters: jsonb().$type<Record<string, string[]>>().default({})
    .notNull(),
  unsupported_filters_at: timestamp({ withTimezone: true, mode: "date" }),
}, (table) => [
  unique("job_platforms_key_unique").on(table.key),
]);

// Audit log of platform edits made via the admin UI. One row per changed
// field per save — lets us trace e.g. "this template changed two weeks ago
// and scrapes started failing yesterday" without bolting full row-level
// auditing onto every table.
export const job_platform_changes = pgTable("job_platform_changes", {
  id: serial().primaryKey().notNull(),
  platform_id: integer().notNull(),
  field: varchar({ length: 64 }).notNull(),
  old_value: text(),
  new_value: text(),
  changed_at: timestamp({ withTimezone: true, mode: "date" }).defaultNow()
    .notNull(),
  changed_by_user_id: text(),
}, (table) => [
  foreignKey({
    columns: [table.platform_id],
    foreignColumns: [job_platforms.id],
    name: "job_platform_changes_platform_id_fk",
  }).onDelete("cascade"),
]);

export const search_task_run_items = pgTable("search_task_run_items", {
  id: serial().primaryKey().notNull(),
  run_id: integer().notNull(),
  position: integer().notNull(),
  clickable_id: integer(),
  title: varchar({ length: 500 }),
  company: varchar({ length: 255 }),
  location: varchar({ length: 255 }),
  source_url: varchar({ length: 2048 }),
  status: varchar({ length: 50 }).default("pending").notNull(),
  status_message: text(),
  job_id: integer(),
  was_created: boolean(),
  created_at: timestamp({ withTimezone: true, mode: "date" }).defaultNow(),
  processed_at: timestamp({ withTimezone: true, mode: "date" }),
}, (table) => [
  index("idx_search_task_run_items_run_status").using(
    "btree",
    table.run_id.asc().nullsLast(),
    table.status.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.job_id],
    foreignColumns: [jobs.id],
    name: "job_search_run_items_job_id_fkey",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.run_id],
    foreignColumns: [search_task_runs.id],
    name: "search_task_run_items_run_id_fkey",
  }).onDelete("cascade"),
]);

export const jobs = pgTable("jobs", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("draft").notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  source_url: varchar({ length: 2048 }),
  title: varchar({ length: 255 }),
  job_description: text(),
  job_poster: varchar({ length: 255 }),
  company_description: text(),
  date_posted: date(),
  salary_min: integer(),
  salary_max: integer(),
  salary_currency: varchar({ length: 255 }),
  salary_period: varchar({ length: 255 }),
  import_error: text(),
  last_scraped: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  office_location: varchar({ length: 255 }),
  scrape_count: integer().default(0),
  job_types: json(),
  experience_levels: json(),
  work_location: json(),
  source_html_stripped: text(),
  job_platform_id: integer(),
  ai_chat_extraction: integer(),
  company: varchar({ length: 255 }),
  skills_required: json(),
  skills_preferred: json(),
  responsibilities: jsonb(),
  soft_skills: jsonb(),
  rescrape_status: varchar({ length: 50 }),
  rescrape_message: text(),
  rescrape_live_url: text(),
  region: varchar({ length: 50 }),
  salary_duration_weeks: doublePrecision(),
  /**
   * True when the job was entered by hand (e.g. via the "New application"
   * form) rather than imported by the scraper. Orthogonal to job_platform_id:
   * a manual job may still carry a real platform when a known URL was given.
   */
  created_manually: boolean().default(false).notNull(),
}, (table) => [
  index("jobs_ai_chat_extraction_idx").on(table.ai_chat_extraction),
  index("jobs_date_posted_idx").on(
    table.date_posted.desc().nullsLast(),
    table.date_created.desc(),
  ),
  index("idx_jobs_uniqueness").using(
    "btree",
    table.title.asc().nullsLast(),
    table.job_poster.asc().nullsLast(),
    table.date_posted.asc().nullsLast(),
  ),
  index("jobs_source_url_idx").using(
    "btree",
    table.source_url.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.ai_chat_extraction],
    foreignColumns: [ai_chats.id],
    name: "jobs_ai_chat_extraction_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.job_platform_id],
    foreignColumns: [job_platforms.id],
    name: "jobs_job_platform_foreign",
  }).onDelete("set null"),
]);

export const profile_tokens = pgTable("profile_tokens", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("published").notNull(),
  sort: integer(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  token: varchar({ length: 255 }).notNull(),
  token_hash: varchar({ length: 255 }).notNull(),
  profile_version: integer().notNull(),
  visit_count: integer().default(0).notNull(),
  visit_limit: integer(),
  expires_at: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  name: varchar({ length: 255 }),
  notes: text(),
  last_accessed_at: timestamp({
    precision: 6,
    withTimezone: true,
    mode: "date",
  }),
  last_accessed_ip: varchar({ length: 45 }),
  format: varchar({ length: 20 }).default("resume").notNull(),
  view_mode: varchar({ length: 10 }).default("html").notNull(),
}, (table) => [
  uniqueIndex("profile_tokens_token_hash_unique").using(
    "btree",
    table.token_hash.asc().nullsLast(),
  ),
  uniqueIndex("profile_tokens_token_unique").using(
    "btree",
    table.token.asc().nullsLast(),
  ),
]);

export const project_stories = pgTable("project_stories", {
  id: integer().default(sql`nextval('project_stories_id_seq'::regclass)`)
    .primaryKey().notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  title: varchar({ length: 255 }),
  situation: text(),
  task: text(),
  action: text(),
  result: text(),
  reflection: text(),
  category: varchar({ length: 255 }),
  profile_id: integer().notNull(),
  // Live AI thread pointer for the conversational story editor (see
  // story_versions). Null until the applicant starts an AI thread on the story.
  ai_chat_id: integer(),
  ai_chat_response: text(),
}, (table) => [
  index("project_stories_ai_chat_id_idx").on(table.ai_chat_id),
  foreignKey({
    columns: [table.ai_chat_id],
    foreignColumns: [ai_chats.id],
    name: "project_stories_ai_chat_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "project_stories_profile_foreign",
  }).onDelete("cascade"),
]);

export const profile_exports = pgTable("profile_exports", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("published").notNull(),
  sort: integer(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  profile_id: integer().notNull(),
  file_id: uuid().notNull(),
  file_type: varchar({ length: 255 }).notNull(),
  export_type: varchar({ length: 255 }).notNull(),
  export_format: varchar({ length: 255 }),
  // Presentation template slug the export was rendered with (a resume_templates
  // slug); null means the default ProfileDisplay template.
  template: varchar({ length: 50 }),
  // Language the export was rendered in (a locale code); null means the base
  // English export. Keeps per-language PDFs distinct at retrieval time.
  locale: varchar({ length: 16 }),
  description: text(),
  source_url: varchar({ length: 512 }),
}, (table) => [
  foreignKey({
    columns: [table.file_id],
    foreignColumns: [files.id],
    name: "profile_exports_file_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "profile_exports_profile_foreign",
  }).onDelete("cascade"),
]);

export const references = pgTable("references", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("draft").notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  author: varchar({ length: 255 }).notNull(),
  author_position: varchar({ length: 255 }),
  text: text(),
  profile_id: integer().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "references_profile_foreign",
  }).onDelete("cascade"),
]);

/**
 * Admin-triggered platform-discovery runs. The admin first creates a
 * job_platforms row with name + base URL; this run then navigates that
 * URL, LLM-analyses the DOM to identify the login link and search
 * entry, submits a probe search, and records a draft template. Applying
 * the findings updates the platform's login_page_url and creates a
 * Generic-search preset on it.
 */
export const search_form_probe_runs = pgTable("search_form_probe_runs", {
  id: serial().primaryKey().notNull(),
  /** Platform this run augments. Discovery always operates on an existing
   *  job_platforms row — admin first creates the platform with name + base
   *  URL, then triggers discovery to fill in login_page_url + a preset. */
  platform_id: integer().notNull(),
  /** Snapshot of the platform's URL at the moment the run was queued. */
  target_url: text().notNull(),
  /** queued | running | success | error | cancelled */
  status: varchar({ length: 50 }).notNull().default("queued"),
  started_at: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
  finished_at: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  error_message: text(),
  /** User-id of the admin who triggered the run. */
  triggered_by_user_id: text(),
  /** Credential to use for login, drawn from platform_credentials.
   *  Optional — if null, discovery proceeds without login (and gated sites
   *  may fail to expose their jobs link). */
  platform_credential_id: integer(),
  /** Device (api_keys row) the discovery should run on. Optional — if
   *  null, the worker uses the default browser provider. Setting this
   *  routes the session through the tunnel to the user's local browser. */
  sjsbrowser_api_key_id: integer(),
  bullmq_job_id: varchar({ length: 100 }),
  live_url: varchar({ length: 500 }),
  /** Draft output from the worker. Shape:
   *   { platform_name, platform_key, search_page_url, search_url_template,
   *     applicable_hint, params, notes[] }
   *  `params` matches `job_platform_search_presets.params` so apply can write
   *  it straight onto the preset. */
  findings: jsonb().$type<{
    platform_name?: string;
    platform_key?: string;
    search_page_url?: string | null;
    search_url_template?: string | null;
    applicable_hint?: string | null;
    params?: Record<
      string,
      | { multi: false; options: Record<string, string> }
      | {
        multi: true;
        param: string;
        sep: string;
        options: Record<string, string>;
      }
    >;
    notes?: string[];
  }>().default({}).notNull(),
  /** Set when the admin applies the findings (timestamp acts as boolean). */
  applied_at: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  /** Legacy column from the original create-on-apply design — kept for now
   *  so old rows still resolve. Mirrors platform_id post-migration. */
  applied_platform_id: integer(),
}, (table) => [
  foreignKey({
    columns: [table.platform_id],
    foreignColumns: [job_platforms.id],
    name: "search_form_probe_runs_platform_id_fkey",
  }).onDelete("cascade"),
]);

/**
 * Worker-emitted log lines for a platform-discovery run. Parallels
 * scraper_logs (which is keyed to search_task_runs).
 */
export const search_form_probe_logs = pgTable("search_form_probe_logs", {
  id: serial().primaryKey().notNull(),
  discovery_run_id: integer().notNull(),
  level: varchar({ length: 10 }).notNull(),
  message: text().notNull(),
  timestamp: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("search_form_probe_logs_run_id_timestamp_idx").using(
    "btree",
    table.discovery_run_id.asc().nullsLast(),
    table.timestamp.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.discovery_run_id],
    foreignColumns: [search_form_probe_runs.id],
    name: "search_form_probe_logs_run_id_fkey",
  }).onDelete("cascade"),
]);

/**
 * HTML debug data for platform discovery runs. Stores both raw and
 * stripped HTML captured during discovery analysis for debugging LLM issues.
 */
export const search_form_probe_debug = pgTable("search_form_probe_debug", {
  id: serial().primaryKey().notNull(),
  /** Discovery run this debug data belongs to */
  discovery_run_id: integer().notNull(),
  /** Stage of discovery: 'search' or 'results' */
  stage: varchar({ length: 20 }).notNull(),
  /** URL of the page when HTML was captured */
  page_url: text().notNull(),
  /** Raw HTML from the browser */
  raw_html: text().notNull(),
  /** Stripped HTML that was sent to the LLM for analysis */
  stripped_html: text().notNull(),
  /** When this debug data was captured */
  captured_at: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("search_form_probe_debug_run_id_idx").using(
    "btree",
    table.discovery_run_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.discovery_run_id],
    foreignColumns: [search_form_probe_runs.id],
    name: "search_form_probe_debug_run_id_fkey",
  }).onDelete("cascade"),
]);

// Hierarchical action groupings within a scraper run. A step opens when the
// scraper enters a logical unit of work ("login", "apply filter", "import
// job") and closes when it finishes. Steps nest via parent_step_id so a UI
// can render the run as a collapsible tree. Each scraper_logs row may
// reference a step via step_id; lines outside any step attach to the run
// root.
export const scraper_log_steps = pgTable("scraper_log_steps", {
  id: serial().primaryKey().notNull(),
  run_id: integer().notNull(),
  parent_step_id: integer(),
  name: text().notNull(),
  // status NULL = still running (or the process died before close). Closed
  // steps carry 'success' | 'error' | 'skipped'.
  status: varchar({ length: 10 }),
  error_message: text(),
  // Arbitrary structured payload attached to the step. Filter heuristics
  // store {canonical, candidates, chosen, score}; item-import steps store
  // {item_id, position}; decisions store {candidates, chosen, reason}.
  metadata: jsonb(),
  started_at: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
  finished_at: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
}, (table) => [
  index("scraper_log_steps_run_id_started_idx").using(
    "btree",
    table.run_id.asc().nullsLast(),
    table.started_at.asc().nullsLast(),
  ),
  index("scraper_log_steps_parent_idx").using(
    "btree",
    table.parent_step_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.run_id],
    foreignColumns: [search_task_runs.id],
    name: "scraper_log_steps_run_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.parent_step_id],
    foreignColumns: [table.id],
    name: "scraper_log_steps_parent_step_id_fkey",
  }).onDelete("cascade"),
]);

export const scraper_logs = pgTable("scraper_logs", {
  id: serial().primaryKey().notNull(),
  run_id: integer().notNull(),
  level: varchar({ length: 10 }).notNull(),
  message: text().notNull(),
  timestamp: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
  // Filename of a debug screenshot captured at the moment this log row was
  // written. Only populated when the owning search_task had
  // debug_screenshots enabled at run time. File lives under
  // /data/scraper-screenshots/<task_id>/<run_id>/<this>.
  screenshot_path: varchar({ length: 255 }),
  // Which process emitted the log. 'cloud' = the worker; 'tunnel' = forwarded
  // from the user's tunnel-client over the WebSocket. Lets the debug UI
  // interleave both views and tag them visually.
  source: varchar({ length: 20 }).default("cloud").notNull(),
  // Intended consumer. 'dev' is the staff debug view; 'user' is surfaced in
  // the customer-facing run status. Default 'dev' so opting into user-facing
  // is explicit at each log site.
  audience: varchar({ length: 10 }).default("dev").notNull(),
  // Owning step, if the log was emitted inside one. NULL = run-root line.
  step_id: integer(),
  // Free-form structured payload — same usage pattern as scraper_log_steps.metadata.
  metadata: jsonb(),
}, (table) => [
  index("scraper_logs_timestamp_idx").on(table.timestamp),
  index("scraper_logs_run_id_timestamp_idx").using(
    "btree",
    table.run_id.asc().nullsLast(),
    table.timestamp.asc().nullsLast(),
  ),
  index("scraper_logs_step_id_idx").using(
    "btree",
    table.step_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.run_id],
    foreignColumns: [search_task_runs.id],
    name: "scraper_logs_run_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.step_id],
    foreignColumns: [scraper_log_steps.id],
    name: "scraper_logs_step_id_fkey",
  }).onDelete("set null"),
]);

export const salary_expectations = pgTable("salary_expectations", {
  id: serial().primaryKey().notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  job_title: varchar({ length: 255 }),
  company_type: varchar({ length: 255 }).notNull(),
  employment_type: varchar({ length: 255 }).notNull(),
  work_arrangement: varchar({ length: 255 }).notNull(),
  region: varchar({ length: 255 }).notNull(),
  hourly_rate: integer(),
  month_salary: integer(),
  year_salary: integer(),
  daily_rate: integer(),
  profile_id: integer().notNull(),
  currency: varchar({ length: 255 }).default("EUR"),
  experience_level: varchar({ length: 255 }),
}, (table) => [
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "salary_expectations_profile_foreign",
  }).onDelete("cascade"),
]);

export const profile_versions = pgTable("profile_versions", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("draft").notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  slug: varchar({ length: 255 }),
  name: text(),
  profile_id: integer().notNull(),
  toggles: json(),
  preview_links: text(),
}, (table): PgTableExtraConfigValue[] => [
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "profile_versions_profile_foreign",
  }).onDelete("cascade"),
]);

/**
 * Multi-language export overlays. English stays canonical in each entity's own
 * columns; this sidecar holds only non-English translations — one row per
 * (entity_type, entity_id, field, locale). Sparse and additive: a missing row
 * falls back to the English base at render time. The translatable-field
 * vocabulary lives in resume-translations.ts.
 */
export const profile_translations = pgTable(
  "profile_translations",
  {
    id: serial().primaryKey().notNull(),
    profile_id: integer().notNull(),
    entity_type: varchar({ length: 64 }).notNull(),
    entity_id: integer().notNull(),
    field: varchar({ length: 64 }).notNull(),
    locale: varchar({ length: 16 }).notNull(),
    value: text().notNull(),
    date_created: timestamp({ withTimezone: true, mode: "date" }),
    date_updated: timestamp({ withTimezone: true, mode: "date" }),
  },
  (table): PgTableExtraConfigValue[] => [
    uniqueIndex("profile_translations_key").on(
      table.profile_id,
      table.entity_type,
      table.entity_id,
      table.field,
      table.locale,
    ),
    index("profile_translations_lookup").on(table.profile_id, table.locale),
    foreignKey({
      columns: [table.profile_id],
      foreignColumns: [profiles.id],
      name: "profile_translations_profile_foreign",
    }).onDelete("cascade"),
  ],
);

export const side_project_technologies = pgTable("side_project_technologies", {
  id: serial().primaryKey().notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  name: varchar({ length: 255 }),
  side_project_id: integer().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.side_project_id],
    foreignColumns: [side_projects.id],
    name: "side_project_technologies_side_project_foreign",
  }).onDelete("cascade"),
]);

export const work_experience_achievements = pgTable(
  "work_experience_achievements",
  {
    id: integer().default(
      sql`nextval('work_experience_achievements_id_seq'::regclass)`,
    ).primaryKey().notNull(),
    status: varchar({ length: 255 }).default("draft").notNull(),
    sort: integer(),
    date_created: timestamp({ withTimezone: true, mode: "date" }),
    date_updated: timestamp({ withTimezone: true, mode: "date" }),
    description: varchar({ length: 255 }),
    work_experience_id: integer().notNull(),
    fa_icon: varchar({ length: 255 }),
    tags: json(),
  },
  (table) => [
    foreignKey({
      columns: [table.work_experience_id],
      foreignColumns: [work_experiences.id],
      name: "work_experience_achievements_work_experience_foreign",
    }).onDelete("cascade"),
  ],
);

export const tech_skill_types = pgTable("tech_skill_types", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("draft").notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  name: varchar({ length: 255 }),
  slug: varchar({ length: 255 }),
}, (table) => [
  uniqueIndex("tech_skill_types_slug_key").using(
    "btree",
    table.slug.asc().nullsLast(),
  ),
]);

export const sessions = pgTable("sessions", {
  id: text().primaryKey().notNull(),
  userId: text().notNull(),
  token: varchar({ length: 255 }).notNull(),
  expiresAt: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .notNull(),
  ipAddress: varchar({ length: 255 }),
  userAgent: text(),
  createdAt: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  updatedAt: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
}, (table) => [
  uniqueIndex("session_token_unique").using(
    "btree",
    table.token.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "session_userid_foreign",
  }).onDelete("cascade"),
]);

export const verifications = pgTable("verifications", {
  id: text().primaryKey().notNull(),
  identifier: varchar({ length: 255 }).notNull(),
  value: varchar({ length: 255 }).notNull(),
  expiresAt: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .notNull(),
  createdAt: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  updatedAt: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
});

export const work_experience_projects = pgTable("work_experience_projects", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("draft").notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  work_experience_id: integer(),
  name: varchar({ length: 255 }),
  url: varchar({ length: 255 }),
  start_date: date(),
  end_date: date(),
  description: text(),
  outcome: text(),
}, (table) => [
  foreignKey({
    columns: [table.work_experience_id],
    foreignColumns: [work_experiences.id],
    name: "work_experience_projects_work_experience_foreign",
  }).onDelete("cascade"),
]);

export const work_experience_technologies = pgTable(
  "work_experience_technologies",
  {
    id: integer().default(
      sql`nextval('work_experience_technologies_id_seq'::regclass)`,
    ).primaryKey().notNull(),
    status: varchar({ length: 255 }).default("draft").notNull(),
    sort: integer(),
    date_created: timestamp({ withTimezone: true, mode: "date" }),
    date_updated: timestamp({ withTimezone: true, mode: "date" }),
    name: varchar({ length: 255 }),
    work_experience_id: integer().notNull(),
    tags: json(),
  },
  (table) => [
    foreignKey({
      columns: [table.work_experience_id],
      foreignColumns: [work_experiences.id],
      name: "work_experience_technologies_work_experience_foreign",
    }).onDelete("cascade"),
  ],
);

export const users = pgTable("users", {
  id: text().primaryKey().notNull(),
  email: varchar({ length: 255 }).notNull(),
  emailVerified: boolean().default(false),
  name: varchar({ length: 255 }),
  image: varchar({ length: 255 }),
  createdAt: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  updatedAt: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  is_admin: boolean().default(false).notNull(),
  is_staff: boolean().default(false).notNull(),
  is_approved: boolean().default(false).notNull(),
  // Ephemeral account minted by a demo invite link (see demo_links). Gates
  // destructive device/account controls and is excluded from real-user metrics.
  is_demo: boolean().default(false).notNull(),
  // The curated source account whose profile is cloned into each demo user.
  // Never a real login; excluded from user lists. Authored on dev, shipped as a
  // fixture (demo:export-template / demo:seed-template).
  is_demo_template: boolean().default(false).notNull(),
  timezone: varchar({ length: 100 }),
  time_format: varchar("time_format", { length: 10 }),
});

export const side_projects = pgTable("side_projects", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("draft").notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  name: varchar({ length: 255 }),
  start_date: date(),
  end_date: date(),
  profile_id: integer().notNull(),
  url: varchar({ length: 255 }),
  repo_url: varchar({ length: 255 }),
  stars: integer(),
  summary: text(),
  tags: json(),
  image_path: varchar({ length: 255 }),
  banner_path: varchar({ length: 255 }),
}, (table) => [
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "side_projects_profile_foreign",
  }).onDelete("cascade"),
]);

export const tech_skill_categories = pgTable("tech_skill_categories", {
  id: integer().default(sql`nextval('tech_skill_categories_id_seq'::regclass)`)
    .primaryKey().notNull(),
  status: varchar({ length: 255 }).default("draft").notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  name: varchar({ length: 255 }),
  profile_id: integer().notNull(),
  fa_icon: varchar({ length: 255 }),
  tags: json(),
  note: text(),
}, (table) => [
  index("tech_skill_categories_profile_idx").on(table.profile_id),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "tech_skill_categories_profile_foreign",
  }).onDelete("cascade"),
]);

export const work_experience_project_technologies = pgTable(
  "work_experience_project_technologies",
  {
    id: serial().primaryKey().notNull(),
    sort: integer(),
    date_created: timestamp({ withTimezone: true, mode: "date" }),
    date_updated: timestamp({ withTimezone: true, mode: "date" }),
    work_experience_project_id: integer(),
    name: varchar({ length: 255 }),
  },
  (table) => [
    foreignKey({
      columns: [table.work_experience_project_id],
      foreignColumns: [work_experience_projects.id],
      name: "work_experience_project_technologies_work___27d59b1f_foreign",
    }).onDelete("cascade"),
  ],
);

export const tech_skills = pgTable("tech_skills", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("draft").notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  name: varchar({ length: 255 }),
  category_id: integer().notNull(),
  level: varchar({ length: 255 }),
  tech_type_id: integer(),
  years_experience: integer(),
  tags: json(),
}, (table) => [
  index("tech_skills_category_idx").on(table.category_id),
  foreignKey({
    columns: [table.category_id],
    foreignColumns: [tech_skill_categories.id],
    name: "tech_skills_category_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.tech_type_id],
    foreignColumns: [tech_skill_types.id],
    name: "tech_skills_tech_type_foreign",
  }),
]);

export const accounts = pgTable("accounts", {
  id: text().primaryKey().notNull(),
  userId: text().notNull(),
  accountId: varchar({ length: 255 }).notNull(),
  providerId: varchar({ length: 255 }).notNull(),
  accessToken: text(),
  refreshToken: text(),
  accessTokenExpiresAt: timestamp({
    precision: 6,
    withTimezone: true,
    mode: "date",
  }),
  refreshTokenExpiresAt: timestamp({
    precision: 6,
    withTimezone: true,
    mode: "date",
  }),
  scope: varchar({ length: 255 }),
  idToken: text(),
  password: varchar({ length: 255 }),
  createdAt: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  updatedAt: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "account_userid_foreign",
  }).onDelete("cascade"),
]);

export const cheat_sheets = pgTable("cheat_sheets", {
  id: integer().default(sql`nextval('cheat_sheets_id_seq'::regclass)`)
    .primaryKey().notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  title: varchar({ length: 255 }),
  content: text(),
  profile_id: integer().notNull(),
  // Live AI thread pointer for the conversational cheat-sheet editor (see
  // cheat_sheet_versions). Null until the applicant starts an AI thread.
  ai_chat_id: integer(),
  ai_chat_response: text(),
}, (table) => [
  index("cheat_sheets_ai_chat_id_idx").on(table.ai_chat_id),
  foreignKey({
    columns: [table.ai_chat_id],
    foreignColumns: [ai_chats.id],
    name: "cheat_sheets_ai_chat_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "cheat_sheets_profile_foreign",
  }).onDelete("cascade"),
]);

export const profile_version_extensions = pgTable(
  "profile_version_extensions",
  {
    id: serial().primaryKey().notNull(),
    extender_id: integer(),
    extended_id: integer(),
  },
  (table) => [
    foreignKey({
      columns: [table.extended_id],
      foreignColumns: [profile_versions.id],
      name: "profile_version_extensions_extended_foreign",
    }).onDelete("set null"),
    foreignKey({
      columns: [table.extender_id],
      foreignColumns: [profile_versions.id],
      name: "profile_version_extensions_extender_foreign",
    }).onDelete("set null"),
  ],
);

export const side_project_achievements = pgTable("side_project_achievements", {
  id: integer().default(
    sql`nextval('side_project_achievements_id_seq'::regclass)`,
  ).primaryKey().notNull(),
  description: varchar({ length: 255 }),
  side_project_id: integer().notNull(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  sort: integer(),
}, (table) => [
  foreignKey({
    columns: [table.side_project_id],
    foreignColumns: [side_projects.id],
    name: "side_project_achievements_side_project_foreign",
  }).onDelete("cascade"),
]);

export const work_experiences = pgTable("work_experiences", {
  name: text().notNull(),
  location: text().notNull(),
  description: text().notNull(),
  position: text().notNull(),
  // Short one-line lead shown above the achievements on a resume (used by the
  // structured templates). Distinct from `summary`, the longer role blurb.
  headline: varchar({ length: 255 }),
  summary: text().notNull(),
  id: serial().primaryKey().notNull(),
  logo_id: uuid(),
  status: varchar({ length: 255 }).default("draft").notNull(),
  sort: integer(),
  profile_id: integer().notNull(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  start_date: date(),
  end_date: date(),
  website: varchar({ length: 255 }),
  tags: json(),
  logo_path: varchar({ length: 255 }),
  banner_path: varchar({ length: 255 }),
}, (table) => [
  foreignKey({
    columns: [table.logo_id],
    foreignColumns: [files.id],
    name: "work_experiences_logo_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "work_experiences_profile_foreign",
  }).onDelete("cascade"),
]);

// Per-profile resume/CV presentation templates. The rendering code is a
// generic, brand-neutral renderer; everything specific to a template (branding,
// fonts, uploaded asset file refs, layout rules) lives here in `config` so that
// no consultancy-specific assets or branding are committed to the repo.
export const resume_templates = pgTable("resume_templates", {
  id: serial().primaryKey().notNull(),
  profile_id: integer().notNull(),
  name: varchar({ length: 255 }).notNull(),
  slug: varchar({ length: 255 }).notNull(),
  status: varchar({ length: 255 }).default("published").notNull(),
  sort: integer(),
  config: jsonb(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
}, (table) => [
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "resume_templates_profile_foreign",
  }).onDelete("cascade"),
]);

export const applications = pgTable("applications", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("draft").notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  job_id: integer(),
  profile_id: integer().notNull(),
  cv_sent_through: varchar({ length: 255 }),
  cv_file_sent_id: uuid(),
  application_sent_date: date(),
  discontinued_reason: varchar({ length: 255 }),
  discontinued_note: text(),
  application_notes: jsonb().$type<
    Array<{ id: string; text: string; created_at: string }>
  >().default([]),
  application_seen_date: date(),
  salary_expectation: numeric({ precision: 10, scale: 2 }),
  salary_currency: varchar({ length: 255 }).default("EUR"),
  salary_period: varchar({ length: 255 }),
  status_step: varchar({ length: 255 }),
  status_action: varchar({ length: 255 }),
  status_action_date: date(),
  cv_version_sent: varchar({ length: 255 }),
  /**
   * A digest of everything recorded on this application, for the
   * cross-application comparison spine. The spine can afford one line per
   * application, not their histories — this is what makes that line say
   * something rather than only count things.
   *
   * Regenerated FROM SOURCE, never revised incrementally: "old summary + a new
   * entry -> revised summary" compounds errors and squeezes out early detail
   * over time. For a handful of entries a clean pass is cheap and correct.
   */
  context_summary: text(),
  /**
   * `v<n>:` + sha256 over the entries the summary was built from. Gates
   * regeneration, so an edit that does not change what the summary depends on
   * costs nothing — and the version makes "what we extract changed" stale the
   * same way "the entries changed" does. See SUMMARY_CONTRACT_VERSION.
   *
   * Text, not varchar(64). Sixty-four is exactly a bare sha256 in hex, so the
   * first thing the version prefix did was fail every update with a value too
   * long — the summariser's own catch swallowed it and four applications
   * silently kept their old summaries. A fingerprint that carries a tag has no
   * natural width; giving it one buys nothing and costs that.
   */
  context_summary_hash: text(),
  context_summary_at: timestamp({ withTimezone: true, mode: "date" }),
  /**
   * Offer terms as structured data rather than prose.
   *
   * Extracted by the same pass as the summary. The point is that comparing two
   * offers stops being re-extraction from two prose blobs at answer time, with
   * no consistency guarantee, on the single highest-stakes question in the
   * product. It also surfaces `respond_by`, which is urgent, actionable and
   * completely invisible today.
   */
  offer_terms: jsonb().$type<
    {
      base: number | null;
      bonus: string | null;
      equity: string | null;
      currency: string | null;
      period: string | null;
      start_date: string | null;
      respond_by: string | null;
      notes: string | null;
    } | null
  >(),
  /**
   * Things this application picked up along the way that the summary cannot
   * carry: a mandatory office day nobody put in the ad, a band named before any
   * offer, a promise to send a take-home on Monday.
   *
   * Written by the same pass as the summary and, like it, REGENERATED FROM
   * SOURCE rather than appended to. A negotiation contradicts itself by design,
   * so a list that accumulated would hold every superseded figure with no way
   * to say which is current. See $lib/application-details.ts for the shape and
   * the reasoning; the type is inlined here because drizzle-kit runs outside
   * Vite and cannot resolve `$lib`.
   */
  context_details: jsonb().$type<
    Array<{
      category: string;
      label: string;
      value: string;
      record_id: number | null;
    }>
  >().default([]).notNull(),
}, (table) => [
  index("applications_profile_status_updated_idx").on(
    table.profile_id,
    table.status,
    table.date_updated.desc(),
  ),
  foreignKey({
    columns: [table.cv_file_sent_id],
    foreignColumns: [files.id],
    name: "applications_cv_file_sent_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.job_id],
    foreignColumns: [jobs.id],
    name: "applications_job_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "applications_profile_foreign",
    // Cascade so deleting a profile (e.g. via a user delete) reaps its
    // applications instead of blocking the delete on this restrict FK.
  }).onDelete("cascade"),
]);

/**
 * API keys identify a physical device (the user's machine running the
 * desktop tunnel client). Owned by the user, not any one profile — the
 * device is the same machine regardless of which profile is active. The
 * tunnel server registers each connection under the owning user_id so
 * every profile of that user sees the device as online.
 */
export const api_keys = pgTable("api_keys", {
  id: serial().primaryKey().notNull(),
  user_id: text().notNull(),
  name: varchar({ length: 255 }).notNull(),
  key_hash: varchar({ length: 64 }).notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`),
  expires_at: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  last_used: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  revoked: boolean().default(false).notNull(),
  key_plain: varchar({ length: 100 }),
}, (table) => [
  uniqueIndex("api_keys_key_hash_key").using(
    "btree",
    table.key_hash.asc().nullsLast(),
  ),
  index("idx_api_keys_user").using(
    "btree",
    table.user_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [users.id],
    name: "api_keys_user_foreign",
  }).onDelete("cascade"),
]);

export const search_tasks = pgTable("search_tasks", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 50 }).default("idle"),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  profile_id: integer().notNull(),
  last_run: timestamp({ withTimezone: true, mode: "date" }),
  search_url: text(),
  platform_id: integer(),
  navigation_type: varchar({ length: 255 }),
  stripped_html: text(),
  last_run_jobs_found: integer(),
  live_url: varchar({ length: 500 }),
  is_active: boolean().default(true).notNull(),
  status_message: varchar({ length: 255 }),
  platform_profile_id: integer(),
  max_jobs: integer(),
  browser_provider: varchar({ length: 20 }),
  search_term: varchar({ length: 500 }),
  skip_existing: boolean().default(false).notNull(),
  skip_first: integer(),
  stop_after_duplicates: integer(),
  keep_minimized: boolean().default(true),
  ui_preferences: jsonb().default({}),
  extracted_jobs_json: text(),
  note: varchar({ length: 500 }),
  schedule_interval_hours: integer(),
  schedule_preferred_hour: integer().default(9),
  next_scheduled_run: timestamp({
    precision: 6,
    withTimezone: true,
    mode: "date",
  }),
  sjsbrowser_api_key: integer(),
  login_mode: varchar({ length: 10 }).default("auto").notNull(),
  // Plain location string the user picked when creating the task. Kept
  // around for tasks created under the legacy URL-template flow; new
  // tasks under the dynamic form-fill flow don't populate it. Will be
  // resurrected when a proper structured location picker lands.
  search_location: text(),
  // User-selected canonical filter values. Single-select filters: a value_key
  // string (e.g. { sort_by: "newest" }). Multi-select filters: an array
  // (e.g. { work_location: ["remote", "hybrid"] }). Consumed at scrape time
  // by the search-form configure step.
  search_filters: jsonb().$type<Record<string, string | string[]>>().default({})
    .notNull(),
  // Staff-only debugging toggle. When true the scraper snapshots the page
  // after each human-action primitive (click/type/scroll) and stores the
  // path on the resulting scraper_logs row. Off by default.
  debug_screenshots: boolean().default(false).notNull(),
  // Provenance: how this task came to exist. `user` = hand-created (the
  // reconciler never touches it), `auto` = generated by the auto-import
  // reconciler, `accepted` = created from a suggestion the user accepted.
  // Existing rows backfill to `user`, which is correct.
  origin: varchar({ length: 16 }).default("user").notNull(),
  // Whether the auto-import reconciler may prune/recompute this task. Set
  // true on auto-creation; flipped to false the moment a user edits an
  // auto task ("adopt"), after which the reconciler leaves it alone but
  // still counts it toward coverage/budget and feeds it to the suggester
  // as existing context for dedup.
  auto_managed: boolean().default(false).notNull(),
  // When the user explicitly paused this task via the list toggle. The
  // reconciler treats a null value as "never user-paused" and may promote a
  // runnable auto proposal to active; a set value means hands-off — promotion
  // must never override a deliberate pause. Cleared when the user re-activates.
  user_paused_at: timestamp({ withTimezone: true, mode: "date" }),
}, (table) => [
  index("search_tasks_next_run_idx").on(table.next_scheduled_run).where(
    sql`is_active AND schedule_interval_hours IS NOT NULL`,
  ),
  index("idx_search_tasks_platform_profile").using(
    "btree",
    table.platform_profile_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "search_tasks_profile_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.platform_id],
    foreignColumns: [job_platforms.id],
    name: "search_tasks_platform_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.platform_profile_id],
    foreignColumns: [platform_profiles.id],
    name: "search_tasks_platform_profile_id_fkey",
  }),
  foreignKey({
    columns: [table.sjsbrowser_api_key],
    foreignColumns: [api_keys.id],
    name: "search_tasks_sjsbrowser_api_key_fkey",
  }).onDelete("set null"),
]);

/**
 * Per-profile state for the auto-import-task reconciler. One row per profile
 * (created lazily on first reconcile). Holds the feature off-switch, the
 * input-hash gate that lets an unchanged-inputs reconcile short-circuit
 * before the LLM, and the home for the (deferred) curation knob.
 */
export const profile_auto_import = pgTable("profile_auto_import", {
  id: serial().primaryKey().notNull(),
  profile_id: integer().notNull(),
  // User off-switch for the whole auto-generation feature.
  enabled: boolean().default(true).notNull(),
  // Hash of the suggester inputs (title, core_stack, skills, location,
  // match_config) at the last sync. Unchanged hash → skip the LLM.
  last_input_hash: text(),
  last_synced_at: timestamp({ withTimezone: true, mode: "date" }),
  // Deferred curation knob ("Minimal/Balanced/Wide" → a target count).
  // Null = use the plan-based default.
  max_tasks: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
  date_updated: timestamp({ withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  unique("profile_auto_import_profile_unique").on(table.profile_id),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "profile_auto_import_profile_foreign",
  }).onDelete("cascade"),
]);

export const ai_chats = pgTable("ai_chats", {
  id: serial().primaryKey().notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  profile_id: integer().notNull(),
  system_prompt: text().notNull(),
  user_prompt: text().notNull(),
  full_prompt: text(),
  response: text(),
  context: json(),
  followup_to: integer(),
  error: text(),
  provider: varchar({ length: 255 }),
  model: varchar({ length: 255 }),
  request_type: varchar({ length: 255 }),
  ai_chat_template: integer(),
  input_tokens: integer(),
  output_tokens: integer(),
  total_tokens: integer(),
  credits_charged: integer(),
}, (table) => [
  index("ai_chats_profile_id_idx").on(table.profile_id),
  index("ai_chats_followup_to_idx").on(table.followup_to),
  index("ai_chats_request_type_idx").on(table.request_type),
  index("ai_chats_date_created_idx").on(table.date_created),
  foreignKey({
    columns: [table.ai_chat_template],
    foreignColumns: [ai_chat_templates.id],
    name: "ai_chats_ai_chat_template_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.followup_to],
    foreignColumns: [table.id],
    name: "ai_chats_followup_to_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "ai_chats_profile_foreign",
  }).onDelete("cascade"),
]);

/**
 * "A generation is currently running for this entity." A row exists only while
 * an LLM generation/followup is in flight (inserted when it starts, deleted in a
 * finally when it ends), so an editor reloaded mid-generation can show a
 * resumable "AI is working…" state instead of losing the spinner. Keyed by
 * (entity_type, entity_id) — entity_type is "story" | "letter" | "question".
 * `started_at` bounds a crashed generation via a staleness TTL (see
 * ai-generation-status.ts); the row is not a foreign key so it can't wedge
 * deletes and works for any future AI surface.
 */
export const ai_generations = pgTable("ai_generations", {
  id: serial().primaryKey().notNull(),
  entity_type: varchar({ length: 50 }).notNull(),
  entity_id: integer().notNull(),
  mode: varchar({ length: 50 }),
  started_at: timestamp({ withTimezone: true, mode: "date" })
    .defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ai_generations_entity_unique").on(
    table.entity_type,
    table.entity_id,
  ),
]);

/**
 * A personal-assistant chat thread. Scoped to a user (not a profile) so the
 * thread can keep going across profile switches; the profile that was active
 * when it started is recorded for reference, and each message records its own.
 */
export const agent_conversations = pgTable("agent_conversations", {
  id: serial().primaryKey().notNull(),
  user_id: text().notNull(),
  profile_id: integer(),
  title: varchar({ length: 255 }),
  date_created: timestamp({ withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
  last_message_at: timestamp({ withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("agent_conversations_user_idx").using(
    "btree",
    table.user_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [users.id],
    name: "agent_conversations_user_foreign",
  }).onDelete("cascade"),
]);

export const agent_messages = pgTable("agent_messages", {
  id: serial().primaryKey().notNull(),
  conversation_id: integer().notNull(),
  role: varchar({ length: 16 }).notNull(),
  content: text().notNull(),
  // The profile this turn was sent under (assistant personalization context).
  profile_id: integer(),
  // Links an assistant turn to its ai_chats audit row for token/credit accounting.
  ai_chat_id: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("agent_messages_ai_chat_id_idx").on(table.ai_chat_id),
  index("agent_messages_conversation_idx").using(
    "btree",
    table.conversation_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.conversation_id],
    foreignColumns: [agent_conversations.id],
    name: "agent_messages_conversation_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.ai_chat_id],
    foreignColumns: [ai_chats.id],
    name: "agent_messages_ai_chat_foreign",
  }).onDelete("set null"),
]);

/**
 * Edits an assistant turn proposed, each pending its own decision — see
 * ai-chat/capabilities.ts.
 *
 * A row per proposal rather than a column on the turn, because one message can
 * propose several: asked to fix a salary *and* rewrite a description, the
 * assistant answers with one entry per capability, and each becomes its own
 * card with its own Apply button. That is the whole reason this is a table —
 * `applied_at` has to be per proposal, or accepting the salary fix would mark
 * the rewrite accepted too.
 *
 * `fields` and `rationale` are the model's, so both are re-validated and
 * re-authorized at apply time. Nothing here is trusted on the way back out.
 */
export const agent_message_proposals = pgTable("agent_message_proposals", {
  id: serial().primaryKey().notNull(),
  message_id: integer().notNull(),
  /** A key of CAPABILITIES. Text, not an enum: the registry is the authority. */
  capability: varchar({ length: 64 }).notNull(),
  rationale: text().notNull().default(""),
  fields: jsonb().$type<Record<string, unknown>>().notNull(),
  target: jsonb().$type<{ id: number; label: string }>().notNull(),
  applied_at: timestamp({ withTimezone: true, mode: "date" }),
  date_created: timestamp({ withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  // Every read is "the proposals for these messages" — the transcript endpoint
  // fetches them for a whole thread at once.
  index("agent_message_proposals_message_idx").on(table.message_id),
  foreignKey({
    columns: [table.message_id],
    foreignColumns: [agent_messages.id],
    name: "agent_message_proposals_message_foreign",
  }).onDelete("cascade"),
]);

export const search_tasks_job_sites = pgTable("search_tasks_job_sites", {
  id: serial().primaryKey().notNull(),
  search_tasks_id: integer(),
}, (table) => [
  foreignKey({
    columns: [table.search_tasks_id],
    foreignColumns: [search_tasks.id],
    name: "search_tasks_job_sites_search_tasks_id_foreign",
  }).onDelete("cascade"),
]);

export const scraper_agent_iterations = pgTable("scraper_agent_iterations", {
  id: serial().primaryKey().notNull(),
  session_id: integer().notNull(),
  iteration: integer().notNull(),
  run_id: integer(),
  run_status: varchar({ length: 50 }),
  items_total: integer(),
  items_completed: integer(),
  items_error: integer(),
  success_pct: doublePrecision(),
  claude_analysis: text(),
  claude_changes: text(),
  started_at: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
  finished_at: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  stage: varchar({ length: 30 }),
  goal_evaluation: text(),
  goal_met: boolean(),
  prompt: text(),
}, (table) => [
  index("scraper_agent_iterations_session_id_iteration_idx").using(
    "btree",
    table.session_id.asc().nullsLast(),
    table.iteration.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.session_id],
    foreignColumns: [scraper_agent_sessions.id],
    name: "scraper_agent_iterations_session_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.run_id],
    foreignColumns: [search_task_runs.id],
    name: "scraper_agent_iterations_run_id_fkey",
  }).onDelete("set null"),
]);

export const scraper_agent_sessions = pgTable("scraper_agent_sessions", {
  id: serial().primaryKey().notNull(),
  search_task_id: integer().notNull(),
  status: varchar({ length: 20 }).default("active").notNull(),
  max_iterations: integer().default(10).notNull(),
  current_iteration: integer().default(0).notNull(),
  claude_session_id: varchar({ length: 255 }),
  system_prompt: text(),
  error_message: text(),
  created_at: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
  updated_at: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
  finished_at: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  run_first: boolean().default(false).notNull(),
  goal: text().notNull(),
  pending_hint: text(),
  needs_input: text(),
}, (table) => [
  index("scraper_agent_sessions_search_task_id_idx").using(
    "btree",
    table.search_task_id.asc().nullsLast(),
  ),
  index("scraper_agent_sessions_status_idx").using(
    "btree",
    table.status.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.search_task_id],
    foreignColumns: [search_tasks.id],
    name: "scraper_agent_sessions_search_task_id_fkey",
  }).onDelete("cascade"),
]);

export const import_logs = pgTable("import_logs", {
  id: serial().primaryKey().notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
  user_id: varchar({ length: 255 }).notNull(),
  user_email: varchar({ length: 255 }),
  profile_id: integer(),
  event: varchar({ length: 50 }).notNull(),
  file_name: varchar({ length: 255 }),
  file_format: varchar({ length: 50 }),
  doc_type: varchar({ length: 20 }),
  sections: json(),
  changes: json(),
  error: text(),
  parsed_data: json(),
  file_id: varchar({ length: 255 }),
}, (table) => [
  index("import_logs_date_created_idx").using(
    "btree",
    table.date_created.asc().nullsLast(),
  ),
  index("import_logs_user_id_idx").using(
    "btree",
    table.user_id.asc().nullsLast(),
  ),
]);

export const job_statuses = pgTable("job_statuses", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("new").notNull(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  job_id: integer().notNull(),
  profile_id: integer().notNull(),
}, (table) => [
  uniqueIndex("job_statuses_profile_job_key").using(
    "btree",
    table.profile_id.asc().nullsLast(),
    table.job_id.asc().nullsLast(),
  ),
  index("job_statuses_profile_status_idx").using(
    "btree",
    table.profile_id.asc().nullsLast(),
    table.status.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.job_id],
    foreignColumns: [jobs.id],
    name: "job_statuses_job_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "job_statuses_profile_fkey",
  }).onDelete("cascade"),
]);

export const profiles = pgTable("profiles", {
  id: serial().primaryKey().notNull(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  name: varchar({ length: 255 }),
  title: varchar({ length: 255 }),
  phone_number: varchar({ length: 255 }),
  email_address: varchar({ length: 255 }),
  personal_website: varchar({ length: 255 }),
  subtitle: varchar({ length: 255 }),
  core_stack: varchar({ length: 255 }),
  linkedin_profile: varchar({ length: 255 }),
  github_profile: varchar({ length: 255 }),
  stackoverflow_profile: varchar({ length: 255 }),
  headline: varchar({ length: 255 }),
  profile_picture_id: uuid(),
  summary: text(),
  nationality: varchar({ length: 255 }),
  location_url: varchar({ length: 255 }),
  location_timezone: varchar({ length: 255 }),
  sort: integer(),
  city: varchar({ length: 255 }),
  region: varchar({ length: 255 }),
  country_code: varchar({ length: 10 }),
  is_default: boolean().default(false),
  slug: varchar({ length: 255 }),
  npm_profile: varchar({ length: 255 }),
  pypi_profile: varchar({ length: 255 }),
  company_name: varchar({ length: 255 }),
  street_address: varchar({ length: 255 }),
  postal_code: varchar({ length: 20 }),
  vat_id: varchar({ length: 50 }),
  kvk_number: varchar({ length: 50 }),
  about_me_text: text(),
  meta_image_url: varchar({ length: 500 }),
  dev_start_year: integer(),
  python_js_start_year: integer(),
  remote_start_year: integer(),
  signal_profile: varchar({ length: 500 }),
  whatsapp_number: varchar({ length: 50 }),
  telegram_username: varchar({ length: 100 }),
  user_id: text(),
  public_cv_version_id: integer(),
  public_resume_version_id: integer(),
  source_cv: uuid(),
  location: varchar({ length: 255 }),
  profile_photo_path: varchar({ length: 255 }),
  browser_user_agent: varchar({ length: 500 }),
  browser_language: varchar({ length: 50 }),
  browser_timezone: varchar({ length: 100 }),
  ui_preferences: jsonb().default({}),
  browser_country_code: varchar({ length: 10 }),
  browser_profile_id: varchar({ length: 100 }),
  salary_base_rate: integer(),
  salary_currency: varchar({ length: 10 }).default("EUR"),
  salary_adjustments: json(),
  salary_region_overrides: json(),
  salary_income_assumptions: jsonb(),
  email_digest_enabled: boolean().default(false),
  email_digest_frequency_days: integer().default(7),
  email_digest_min_score: integer().default(70),
  email_digest_last_sent_at: timestamp({
    precision: 6,
    withTimezone: true,
    mode: "date",
  }),
  email_digest_preferred_hour: integer().default(9),
  email_digest_send_to: varchar({ length: 20 }).default("profile"),
}, (table) => [
  index("profiles_user_id_idx").using(
    "btree",
    table.user_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.profile_picture_id],
    foreignColumns: [files.id],
    name: "profiles_profile_picture_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.public_cv_version_id],
    foreignColumns: [profile_versions.id],
    name: "profiles_public_cv_version_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.public_resume_version_id],
    foreignColumns: [profile_versions.id],
    name: "profiles_public_resume_version_foreign",
  }).onDelete("set null"),
  // Deleting a user reaps their profiles (and everything cascading off them).
  // Without this FK a hard-deleted user leaves orphaned profile rows the matcher
  // keeps picking up, crashing every cycle in the credit_balances upsert.
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [users.id],
    name: "profiles_user_id_fkey",
  }).onDelete("cascade"),
  unique("profiles_slug_unique").on(table.slug),
]);

export const application_letters = pgTable("application_letters", {
  id: serial().primaryKey().notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  application_id: integer().notNull(),
  letter_type: varchar({ length: 255 }).default("cover_letter").notNull(),
  content: text(),
  ai_chat_id: integer(),
  status: varchar({ length: 255 }).default("draft").notNull(),
  ai_chat_response: text(),
}, (table) => [
  index("application_letters_ai_chat_id_idx").on(table.ai_chat_id),
  foreignKey({
    columns: [table.ai_chat_id],
    foreignColumns: [ai_chats.id],
    name: "application_letters_ai_chat_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.application_id],
    foreignColumns: [applications.id],
    name: "application_letters_application_foreign",
  }).onDelete("cascade"),
]);

export const application_questions = pgTable("application_questions", {
  id: serial().primaryKey().notNull(),
  sort: integer(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  application_id: integer().notNull(),
  question: text().notNull(),
  answer: text(),
  ai_chat_id: integer(),
  ai_chat_response: text(),
}, (table) => [
  index("application_questions_ai_chat_id_idx").on(table.ai_chat_id),
  foreignKey({
    columns: [table.ai_chat_id],
    foreignColumns: [ai_chats.id],
    name: "application_questions_ai_chat_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.application_id],
    foreignColumns: [applications.id],
    name: "application_questions_application_foreign",
  }).onDelete("cascade"),
]);

export const application_status_log = pgTable("application_status_log", {
  id: serial().primaryKey().notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  application: integer().notNull(),
  from_status: varchar({ length: 255 }),
  to_status: varchar({ length: 255 }).notNull(),
  description: text(),
  step: varchar({ length: 255 }),
  action: varchar({ length: 255 }),
  action_date: date(),
}, (table) => [
  foreignKey({
    columns: [table.application],
    foreignColumns: [applications.id],
    name: "application_status_log_application_foreign",
  }).onDelete("cascade"),
]);

/**
 * Long-form written record of what actually happened during an application:
 * correspondence, interview recaps and transcripts, recruiter feedback,
 * assessment briefs, offers and contracts, company research, loose notes.
 *
 * This used to be text-only, with uploaded files living separately in
 * `applications_files` — "deliberately text so the content is usable as AI
 * context". That reasoning expired when `extracted_text` shipped: files ARE
 * text now, and the split only ever sorted artefacts by whether their source
 * happened to have a download button (an email exports cleanly and became a
 * document; the same conversation on LinkedIn had to be pasted and became a
 * record). One entity, two input methods — see planning/APPLICATION-ACTIVITY.md.
 *
 * `content` is the single text field either way: typed by the user, or filled
 * by extraction from `file_id`. Once extracted it stays user-editable and may
 * diverge from the file, which is deliberate (fix bad OCR, trim a quoted reply
 * chain) — the file is provenance, not the source of truth.
 *
 * `status_log` optionally ties a record to the timeline event it belongs to,
 * so a "Technical interview" entry and its debrief stay one thing rather than
 * drifting apart in two lists. It is decorative rather than structural: `step`
 * carries the stage label and is defaulted from the application's current
 * status, so every record has a stage whether or not this FK is set.
 */
export const application_records = pgTable("application_records", {
  id: serial().primaryKey().notNull(),
  application_id: integer().notNull(),
  record_type: varchar({ length: 50 }).default("interview_recap").notNull(),
  title: varchar({ length: 255 }).notNull(),
  content: text(),
  /** When the interview/email/event happened — distinct from date_created. */
  event_date: date(),
  /** Stage label, from `stepsByPhase` in $lib/application-status. */
  step: varchar({ length: 255 }),
  status_log: integer(),
  sort: integer(),
  /** The uploaded file this record came from, if any. Null for typed entries. */
  file_id: uuid(),
  /**
   * Extraction lifecycle for `file_id`. Four states, and the fourth matters:
   * "none" is a typed record with no file, distinct from "pending" (has a file,
   * never extracted). Without it every pasted note reads as an extraction
   * backlog. "extracted" and "skipped" are terminal — file_id is immutable, so
   * a re-upload is a new row and a skip is never retried.
   */
  extraction_status: varchar({ length: 32 }).default("none").notNull(),
  extraction_error: text(),
  date_extracted: timestamp({ withTimezone: true, mode: "date" }),
  /**
   * People involved: `[{ name, role }]`, role from `contactRoles`. A contact is
   * not an attribute of one record but an entity recurring across them — the
   * same interviewer appears in a recap, a transcript and three messages — so
   * this is the read-time grouping key, and the promotion path when a person
   * needs an identity is a table (see $lib/application-records.ts).
   */
  contacts: jsonb().$type<Array<{ name: string; role: string | null }>>()
    .default([]).notNull(),
  /**
   * Raw provenance kept because discarding it is lossy: email headers,
   * message-ids, file metadata. NEVER queried and never the basis of a feature
   * — typed columns for what features consume, this for the rest, nothing in
   * between. A general-purpose metadata bag would be write-flexible and
   * read-useless: nothing can consume a key it does not know exists.
   */
  source_meta: jsonb(),
  /**
   * When the derivation pass last analysed `content` to fill title / type /
   * event_date / contacts. NULL means never analysed — and that distinction is
   * load-bearing, not cosmetic: aggregates like "no employer contact yet on
   * this application" read `contacts` being empty, which without this column
   * conflates *nobody was involved* with *nobody has looked yet*. Same
   * empty-vs-never-looked trap as generation-context.ts's emptyNote/droppedNote.
   *
   * Re-derivation triggers on `date_updated > derived_at`, so edited content
   * gets fresh metadata and untouched content never pays for a second LLM call.
   */
  derived_at: timestamp({ withTimezone: true, mode: "date" }),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .defaultNow(),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
}, (table) => [
  index("application_records_application_idx").on(table.application_id),
  index("application_records_status_log_idx").on(table.status_log),
  index("application_records_file_idx").on(table.file_id),
  foreignKey({
    columns: [table.file_id],
    foreignColumns: [files.id],
    name: "application_records_file_foreign",
    // Losing the blob shouldn't delete the record written about it — the
    // extracted text in `content` is the part that carries the value.
  }).onDelete("set null"),
  foreignKey({
    columns: [table.application_id],
    foreignColumns: [applications.id],
    name: "application_records_application_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.status_log],
    foreignColumns: [application_status_log.id],
    name: "application_records_status_log_foreign",
    // Losing the timeline entry shouldn't shred the debrief written about it.
  }).onDelete("set null"),
]);

export const letter_versions = pgTable("letter_versions", {
  id: serial().primaryKey().notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .defaultNow(),
  letter: integer().notNull(),
  content: text(),
  source: varchar({ length: 255 }).notNull(),
  ai_chat: integer(),
  ai_feedback: text(),
  user_request: text(),
}, (table) => [
  index("letter_versions_ai_chat_idx").on(table.ai_chat),
  foreignKey({
    columns: [table.ai_chat],
    foreignColumns: [ai_chats.id],
    name: "letter_versions_ai_chat_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.letter],
    foreignColumns: [application_letters.id],
    name: "letter_versions_letter_foreign",
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const question_versions = pgTable("question_versions", {
  id: serial().primaryKey().notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .defaultNow(),
  question: integer().notNull(),
  content: text(),
  source: varchar({ length: 255 }).notNull(),
  ai_chat: integer(),
  ai_feedback: text(),
  user_request: text(),
}, (table) => [
  index("question_versions_ai_chat_idx").on(table.ai_chat),
  foreignKey({
    columns: [table.ai_chat],
    foreignColumns: [ai_chats.id],
    name: "question_versions_ai_chat_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.question],
    foreignColumns: [application_questions.id],
    name: "question_versions_question_foreign",
  }).onUpdate("cascade").onDelete("cascade"),
]);

// Append-only version trail for the conversational project-story editor.
// Mirrors question_versions (identical shape, `story` FK instead of `question`);
// see entity-versions.ts for the shared record/build/trim engine. `content`
// holds one canonical STAR markdown document per version (see $lib/interview/star).
export const story_versions = pgTable("story_versions", {
  id: serial().primaryKey().notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .defaultNow(),
  story: integer().notNull(),
  content: text(),
  source: varchar({ length: 255 }).notNull(),
  ai_chat: integer(),
  ai_feedback: text(),
  user_request: text(),
}, (table) => [
  index("story_versions_ai_chat_idx").on(table.ai_chat),
  index("story_versions_story_idx").on(table.story),
  foreignKey({
    columns: [table.ai_chat],
    foreignColumns: [ai_chats.id],
    name: "story_versions_ai_chat_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.story],
    foreignColumns: [project_stories.id],
    name: "story_versions_story_foreign",
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const cheat_sheet_versions = pgTable("cheat_sheet_versions", {
  id: serial().primaryKey().notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .defaultNow(),
  cheat_sheet: integer().notNull(),
  content: text(),
  source: varchar({ length: 255 }).notNull(),
  ai_chat: integer(),
  ai_feedback: text(),
  user_request: text(),
}, (table) => [
  index("cheat_sheet_versions_ai_chat_idx").on(table.ai_chat),
  index("cheat_sheet_versions_cheat_sheet_idx").on(table.cheat_sheet),
  foreignKey({
    columns: [table.ai_chat],
    foreignColumns: [ai_chats.id],
    name: "cheat_sheet_versions_ai_chat_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.cheat_sheet],
    foreignColumns: [cheat_sheets.id],
    name: "cheat_sheet_versions_cheat_sheet_foreign",
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const job_match_history = pgTable("job_match_history", {
  id: serial().primaryKey().notNull(),
  job_id: integer().notNull(),
  profile_id: integer().notNull(),
  score: integer().default(0).notNull(),
  skill_match_percentage: integer(),
  recommendation: varchar({ length: 255 }),
  match_summary: text(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .defaultNow(),
}, (table) => [
  index("job_match_history_date_idx").using(
    "btree",
    table.job_id.asc().nullsLast(),
    table.date_created.desc().nullsFirst(),
  ),
  index("job_match_history_profile_job_idx").using(
    "btree",
    table.profile_id.asc().nullsLast(),
    table.job_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.job_id],
    foreignColumns: [jobs.id],
    name: "job_match_history_job_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "job_match_history_profile_foreign",
  }).onDelete("cascade"),
]);

export const job_importers = pgTable("job_importers", {
  id: serial().primaryKey().notNull(),
  date_created: timestamp({ withTimezone: true, mode: "date" }).default(
    sql`CURRENT_TIMESTAMP`,
  ),
  job_id: integer().notNull(),
  profile_id: integer().notNull(),
}, (table) => [
  index("job_importers_profile_job_idx").on(table.profile_id, table.job_id),
  uniqueIndex("job_importers_job_profile_unique").using(
    "btree",
    table.job_id.asc().nullsLast(),
    table.profile_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.job_id],
    foreignColumns: [jobs.id],
    name: "job_importers_job_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "job_importers_profile_foreign",
  }).onDelete("cascade"),
]);

export const user_feedback_files = pgTable("user_feedback_files", {
  id: serial().primaryKey().notNull(),
  user_feedback_id: integer().notNull(),
  file_id: uuid().notNull(),
}, (table) => [
  index("user_feedback_files_feedback_idx").using(
    "btree",
    table.user_feedback_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.user_feedback_id],
    foreignColumns: [user_feedback.id],
    name: "user_feedback_files_user_feedback_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
  foreignKey({
    columns: [table.file_id],
    foreignColumns: [files.id],
    name: "user_feedback_files_directus_files_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const user_feedback = pgTable("user_feedback", {
  id: serial().primaryKey().notNull(),
  user_id: text().notNull(),
  profile_id: integer(),
  category: varchar({ length: 50 }).default("other").notNull(),
  message: text().notNull(),
  page_url: varchar({ length: 1000 }),
  status: varchar({ length: 50 }).default("new").notNull(),
  admin_note: text(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .defaultNow(),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  merged_into_id: integer(),
}, (table) => [
  index("user_feedback_category_idx").using(
    "btree",
    table.category.asc().nullsLast(),
  ),
  index("user_feedback_date_created_idx").using(
    "btree",
    table.date_created.asc().nullsLast(),
  ),
  index("user_feedback_merged_into_idx").using(
    "btree",
    table.merged_into_id.asc().nullsLast(),
  ),
  index("user_feedback_status_idx").using(
    "btree",
    table.status.asc().nullsLast(),
  ),
  index("user_feedback_user_id_idx").using(
    "btree",
    table.user_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.merged_into_id],
    foreignColumns: [table.id],
    name: "user_feedback_merged_into_id_fkey",
  }).onUpdate("cascade").onDelete("set null"),
]);

export const billing_customers = pgTable("billing_customers", {
  id: serial().primaryKey().notNull(),
  user_id: text().notNull(),
  stripe_customer_id: varchar({ length: 255 }).notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [users.id],
    name: "billing_customers_user_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
  unique("billing_customers_user_id_key").on(table.user_id),
  unique("billing_customers_stripe_customer_id_key").on(
    table.stripe_customer_id,
  ),
]);

export const subscriptions = pgTable("subscriptions", {
  id: serial().primaryKey().notNull(),
  user_id: text().notNull(),
  stripe_subscription_id: varchar({ length: 255 }).notNull(),
  stripe_price_id: varchar({ length: 255 }).notNull(),
  plan: varchar({ length: 50 }).notNull(),
  status: varchar({ length: 50 }).default("active").notNull(),
  current_period_start: timestamp({
    precision: 6,
    withTimezone: true,
    mode: "date",
  }).notNull(),
  current_period_end: timestamp({
    precision: 6,
    withTimezone: true,
    mode: "date",
  }).notNull(),
  cancel_at_period_end: boolean().default(false).notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .defaultNow(),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
}, (table) => [
  index("subscriptions_status_idx").using(
    "btree",
    table.status.asc().nullsLast(),
  ),
  index("subscriptions_user_id_idx").using(
    "btree",
    table.user_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [users.id],
    name: "subscriptions_user_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
  unique("subscriptions_stripe_subscription_id_key").on(
    table.stripe_subscription_id,
  ),
]);

export const credit_purchases = pgTable("credit_purchases", {
  id: serial().primaryKey().notNull(),
  user_id: text().notNull(),
  stripe_payment_intent_id: varchar({ length: 255 }),
  pack_type: varchar({ length: 50 }).notNull(),
  amount_cents: integer().notNull(),
  period: varchar({ length: 7 }).notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .defaultNow(),
}, (table) => [
  index("credit_purchases_user_id_idx").using(
    "btree",
    table.user_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [users.id],
    name: "credit_purchases_user_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const usage_counters = pgTable("usage_counters", {
  id: serial().primaryKey().notNull(),
  user_id: text().notNull(),
  period: varchar({ length: 7 }).notNull(),
  ai_generations: integer().default(0).notNull(),
  ai_followups: integer().default(0).notNull(),
  job_matches: integer().default(0).notNull(),
  scrape_runs: integer().default(0).notNull(),
  pdf_exports: integer().default(0).notNull(),
  resume_parses: integer().default(0).notNull(),
  extra_ai_generations: integer().default(0).notNull(),
  extra_ai_followups: integer().default(0).notNull(),
  extra_job_matches: integer().default(0).notNull(),
  extra_scrape_runs: integer().default(0).notNull(),
}, (table) => [
  index("usage_counters_period_idx").using(
    "btree",
    table.period.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [users.id],
    name: "usage_counters_user_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
  unique("usage_counters_user_id_period_key").on(table.user_id, table.period),
]);

export const verification_email_addresses = pgTable(
  "verification_email_addresses",
  {
    id: serial().primaryKey().notNull(),
    profile_id: integer().notNull(),
    email_token: varchar({ length: 64 }).notNull(),
    full_address: varchar({ length: 255 }).notNull(),
    is_active: boolean().default(true).notNull(),
    created_at: timestamp({ precision: 6, withTimezone: true, mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`).notNull(),
    last_used_at: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("verification_email_addresses_email_token_key").using(
      "btree",
      table.email_token.asc().nullsLast(),
    ),
    uniqueIndex("verification_email_addresses_profile_id_key").using(
      "btree",
      table.profile_id.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.profile_id],
      foreignColumns: [profiles.id],
      name: "verification_email_addresses_profile_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const credit_balances = pgTable("credit_balances", {
  id: serial().primaryKey().notNull(),
  user_id: text().notNull(),
  period: varchar({ length: 10 }).notNull(),
  credits_used: integer().default(0).notNull(),
  credits_allowance: integer().default(0).notNull(),
  extra_credits: integer().default(0).notNull(),
}, (table) => [
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [users.id],
    name: "credit_balances_user_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
  unique("credit_balances_user_id_period_key").on(table.user_id, table.period),
]);

export const credit_transactions = pgTable("credit_transactions", {
  id: serial().primaryKey().notNull(),
  user_id: text().notNull(),
  amount: integer().notNull(),
  balance_after: integer(),
  operation: varchar({ length: 100 }).notNull(),
  description: text(),
  metadata: jsonb(),
  created_at: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .defaultNow().notNull(),
}, (table) => [
  index("credit_transactions_operation_idx").using(
    "btree",
    table.operation.asc().nullsLast(),
  ),
  index("credit_transactions_user_id_created_idx").using(
    "btree",
    table.user_id.asc().nullsLast(),
    table.created_at.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.user_id],
    foreignColumns: [users.id],
    name: "credit_transactions_user_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const certificates = pgTable("certificates", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("draft").notNull(),
  sort: integer(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  name: varchar({ length: 255 }).notNull(),
  issuer: varchar({ length: 255 }),
  date: date(),
  url: varchar({ length: 255 }),
  profile_id: integer().notNull(),
}, (table) => [
  index("idx_certificates_profile").using(
    "btree",
    table.profile_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "certificates_profile_foreign",
  }).onDelete("cascade"),
]);

export const inbound_emails = pgTable("inbound_emails", {
  id: serial().primaryKey().notNull(),
  verification_address_id: integer(),
  run_id: integer(),
  from_address: varchar({ length: 255 }).notNull(),
  subject: varchar({ length: 500 }),
  body_text: text(),
  body_html: text(),
  extracted_code: varchar({ length: 50 }),
  extracted_link: varchar({ length: 2000 }),
  status: varchar({ length: 20 }).default("received").notNull(),
  received_at: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
  applied_at: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  recipient: varchar({ length: 255 }).notNull(),
  handler: varchar({ length: 50 }),
}, (table) => [
  index("idx_inbound_emails_address").using(
    "btree",
    table.verification_address_id.asc().nullsLast(),
  ),
  index("idx_inbound_emails_handler").using(
    "btree",
    table.handler.asc().nullsLast(),
  ),
  index("idx_inbound_emails_received").using(
    "btree",
    table.received_at.asc().nullsLast(),
  ),
  index("idx_inbound_emails_run").using(
    "btree",
    table.run_id.asc().nullsLast(),
  ),
  index("idx_inbound_emails_status").using(
    "btree",
    table.status.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.verification_address_id],
    foreignColumns: [verification_email_addresses.id],
    name: "inbound_emails_address_fkey",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.run_id],
    foreignColumns: [search_task_runs.id],
    name: "inbound_emails_run_fkey",
  }).onDelete("set null"),
]);

export const sent_emails = pgTable("sent_emails", {
  id: serial().primaryKey().notNull(),
  to: varchar({ length: 255 }).notNull(),
  subject: varchar({ length: 500 }).notNull(),
  html: text().notNull(),
  type: varchar({ length: 50 }).notNull(),
  status: varchar({ length: 20 }).default("sent").notNull(),
  error: text(),
  sent_at: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
  user_id: text(),
  metadata: jsonb(),
}, (table) => [
  index("idx_sent_emails_type").using(
    "btree",
    table.type.asc().nullsLast(),
  ),
  index("idx_sent_emails_status").using(
    "btree",
    table.status.asc().nullsLast(),
  ),
  index("idx_sent_emails_sent_at").using(
    "btree",
    table.sent_at.asc().nullsLast(),
  ),
  index("idx_sent_emails_user").using(
    "btree",
    table.user_id.asc().nullsLast(),
  ),
]);

export const contacts = pgTable("contacts", {
  id: serial().primaryKey().notNull(),
  requester_id: text().notNull(),
  recipient_id: text().notNull(),
  status: varchar({ length: 20 }).default("pending").notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
}, (table) => [
  uniqueIndex("contacts_pair_unique").using(
    "btree",
    table.requester_id.asc().nullsLast(),
    table.recipient_id.asc().nullsLast(),
  ),
  index("idx_contacts_recipient").using(
    "btree",
    table.recipient_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.recipient_id],
    foreignColumns: [users.id],
    name: "contacts_recipient_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.requester_id],
    foreignColumns: [users.id],
    name: "contacts_requester_id_fkey",
  }).onDelete("cascade"),
]);

/**
 * Cross-user credential sharing. Owner = platform_credentials.user_id;
 * `shared_with` = the user the credential is shared with. Intra-user
 * "sharing" doesn't need a row here — credentials are user-scoped, so all
 * of an owner's profiles see them directly.
 */
export const credential_shares = pgTable("credential_shares", {
  id: serial().primaryKey().notNull(),
  platform_credential_id: integer().notNull(),
  shared_with: text().notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("credential_shares_credential_user_unique").using(
    "btree",
    table.platform_credential_id.asc().nullsLast(),
    table.shared_with.asc().nullsLast(),
  ),
  index("idx_credential_shares_shared_with").using(
    "btree",
    table.shared_with.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.shared_with],
    foreignColumns: [users.id],
    name: "credential_shares_shared_with_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.platform_credential_id],
    foreignColumns: [platform_credentials.id],
    name: "credential_shares_platform_credential_id_fkey",
  }).onDelete("cascade"),
]);

export const device_shares = pgTable("device_shares", {
  id: serial().primaryKey().notNull(),
  api_key_id: integer().notNull(),
  shared_with: text().notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("device_shares_key_user_unique").using(
    "btree",
    table.api_key_id.asc().nullsLast(),
    table.shared_with.asc().nullsLast(),
  ),
  index("idx_device_shares_shared_with").using(
    "btree",
    table.shared_with.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.shared_with],
    foreignColumns: [users.id],
    name: "device_shares_shared_with_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.api_key_id],
    foreignColumns: [api_keys.id],
    name: "device_shares_api_key_id_fkey",
  }).onDelete("cascade"),
]);

// A shareable demo invite link. One link → one ephemeral demo user, minted on
// first open and resumed on later opens until expiry. The link grants access to
// the creator's devices (demo_link_devices) so scraping works out of the box.
export const demo_links = pgTable("demo_links", {
  id: serial().primaryKey().notNull(),
  // Opaque token in the public URL (/demo/<token>).
  token: varchar({ length: 255 }).notNull(),
  // Admin who created the link (and whose devices it shares).
  created_by: text().notNull(),
  // TTL chosen at creation; expires_at is stamped from creation so an unopened
  // link doesn't live forever.
  ttl_seconds: integer().notNull(),
  expires_at: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .notNull(),
  // Per-link scrape-run ceiling; null = no extra cap beyond the plan/device limits.
  max_runs: integer(),
  // active | revoked | expired
  status: varchar({ length: 20 }).default("active").notNull(),
  // The demo user minted for this link; null until first open.
  demo_user_id: text(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("demo_links_token_unique").using(
    "btree",
    table.token.asc().nullsLast(),
  ),
  index("idx_demo_links_created_by").using(
    "btree",
    table.created_by.asc().nullsLast(),
  ),
  index("idx_demo_links_demo_user").using(
    "btree",
    table.demo_user_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.created_by],
    foreignColumns: [users.id],
    name: "demo_links_created_by_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.demo_user_id],
    foreignColumns: [users.id],
    name: "demo_links_demo_user_id_fkey",
  }).onDelete("set null"),
]);

// Which of the creator's devices a demo link grants. On first open, each row
// becomes a device_shares grant for the minted demo user.
export const demo_link_devices = pgTable("demo_link_devices", {
  id: serial().primaryKey().notNull(),
  demo_link_id: integer().notNull(),
  api_key_id: integer().notNull(),
}, (table) => [
  uniqueIndex("demo_link_devices_link_key_unique").using(
    "btree",
    table.demo_link_id.asc().nullsLast(),
    table.api_key_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.demo_link_id],
    foreignColumns: [demo_links.id],
    name: "demo_link_devices_demo_link_id_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.api_key_id],
    foreignColumns: [api_keys.id],
    name: "demo_link_devices_api_key_id_fkey",
  }).onDelete("cascade"),
]);

export const feedback_replies = pgTable("feedback_replies", {
  id: serial().primaryKey().notNull(),
  feedback_id: integer().notNull(),
  user_id: text().notNull(),
  is_admin: boolean().default(false).notNull(),
  message: text().notNull(),
  created_at: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("feedback_replies_feedback_idx").using(
    "btree",
    table.feedback_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.feedback_id],
    foreignColumns: [user_feedback.id],
    name: "feedback_replies_feedback_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const user_feedback_subscribers = pgTable("user_feedback_subscribers", {
  id: serial().primaryKey().notNull(),
  feedback_id: integer().notNull(),
  user_id: text().notNull(),
  subscribed_at: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  uniqueIndex("user_feedback_subscribers_unique").using(
    "btree",
    table.feedback_id.asc().nullsLast(),
    table.user_id.asc().nullsLast(),
  ),
  index("user_feedback_subscribers_user_idx").using(
    "btree",
    table.user_id.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.feedback_id],
    foreignColumns: [user_feedback.id],
    name: "user_feedback_subscribers_feedback_id_fkey",
  }).onUpdate("cascade").onDelete("cascade"),
]);

export const notifications = pgTable("notifications", {
  id: serial().primaryKey().notNull(),
  user_id: text().notNull(),
  type: varchar({ length: 50 }).notNull(),
  title: varchar({ length: 200 }).notNull(),
  message: text(),
  link: varchar({ length: 500 }),
  read_at: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  created_at: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("notifications_user_unread_idx").using(
    "btree",
    table.user_id.asc().nullsLast(),
    table.read_at.asc().nullsLast(),
  ),
]);

export const files = pgTable("files", {
  id: uuid().primaryKey().notNull(),
  storage: varchar({ length: 255 }).notNull(),
  filename_disk: varchar({ length: 255 }),
  filename_download: varchar({ length: 255 }).notNull(),
  title: varchar({ length: 255 }),
  type: varchar({ length: 255 }),
  charset: varchar({ length: 50 }),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  filesize: bigint({ mode: "number" }),
  width: integer(),
  height: integer(),
  duration: integer(),
  embed: varchar({ length: 200 }),
  description: text(),
  location: text(),
  tags: text(),
  metadata: json(),
  focal_point_x: integer(),
  focal_point_y: integer(),
  tus_id: varchar({ length: 64 }),
  tus_data: json(),
  uploaded_on: timestamp({ withTimezone: true, mode: "date" }),
  created_on: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
  modified_on: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// --- Document ingestion (see planning/DOCUMENT-INGESTION.md) ---
// A user uploads files / a ZIP to their profile; we extract text and summarize
// it for AI features. The ingestion UNIT is a "project" (one upload / archive),
// grouping its extracted source files. The raw archive is NOT retained — only
// extracted text — so junk (node_modules, binaries) never sits at rest.
export const profile_document_projects = pgTable("profile_document_projects", {
  id: serial().primaryKey().notNull(),
  profile_id: integer().notNull(),
  // The project this upload belongs to — either a work-experience project or a
  // side (personal) project. Nullable so a legacy/unattached row can exist, but
  // the UI always attaches to one.
  work_experience_id: integer(),
  work_experience_project_id: integer(),
  side_project_id: integer(),
  // Original blob for a loose single-file upload (e.g. a PDF); null for
  // archives, whose raw bytes are discarded after extraction.
  file_id: uuid(),
  kind: varchar({ length: 16 }).default("file").notNull(), // "file" | "archive" | "github_repo" | ...
  title: varchar({ length: 255 }),
  original_filename: varchar({ length: 512 }),
  // Provider-agnostic provenance for the attachment. Uploads:
  // { type: "upload" | "archive", filename }. Future git sources:
  // { type: "github_repo", owner, repo, ref, sha, visibility, url }. Generalizes
  // original_filename so new source types need no new columns.
  source: jsonb(),
  // LLM project-level "reference notes" — the retrievable unit for job-aware
  // prompts (NOT merged into collected_data; see DOCUMENT-INGESTION.md § AI).
  summary: text(),
  // Key technologies/keywords the summarizer extracted, for deterministic
  // project↔job relevance ranking.
  keywords: json(),
  status: varchar({ length: 32 }).default("pending").notNull(),
  // pending | extracting | extracted | partial | failed
  extraction_error: text(),
  // Manifest of skipped archive entries [{ path, reason }] for user visibility.
  skipped: json(),
  file_count: integer().default(0).notNull(),
  total_chars: integer().default(0).notNull(),
  total_bytes: integer().default(0).notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
}, (table) => [
  index("profile_document_projects_profile_idx").on(table.profile_id),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "profile_document_projects_profile_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.work_experience_id],
    foreignColumns: [work_experiences.id],
    name: "profile_document_projects_work_experience_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.work_experience_project_id],
    foreignColumns: [work_experience_projects.id],
    name: "profile_document_projects_work_experience_project_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.side_project_id],
    foreignColumns: [side_projects.id],
    name: "profile_document_projects_side_project_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.file_id],
    foreignColumns: [files.id],
    name: "profile_document_projects_file_foreign",
  }).onDelete("set null"),
]);

export const profile_document_files = pgTable("profile_document_files", {
  id: serial().primaryKey().notNull(),
  project_id: integer().notNull(),
  // Sanitized, archive-relative path (e.g. "src/lib/foo.ts").
  path: varchar({ length: 1024 }),
  ext: varchar({ length: 32 }),
  extracted_text: text(),
  chars: integer().default(0).notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
}, (table) => [
  index("profile_document_files_project_idx").on(table.project_id),
  foreignKey({
    columns: [table.project_id],
    foreignColumns: [profile_document_projects.id],
    name: "profile_document_files_project_foreign",
  }).onDelete("cascade"),
]);

// Cached embeddings for the applicant's OWN projects — the corpus for semantic
// RAG retrieval (which of a user's projects fit a given job, cited in cover
// letters / application answers, and fed to match scoring).
//
// One row per EMBEDDABLE UNIT, not per project, so a project with several
// attachments (multiple uploads and/or git repos) keeps a distinct vector for
// each source instead of averaging them into one blurry project vector:
//   - source_type "project_typed" (attachment_id 0): the project's own typed
//     data (name/description/technologies/achievements).
//   - source_type "attachment" (attachment_id = profile_document_projects.id):
//     one uploaded doc/archive/repo.
// Retrieval max-pools a project's units → project relevance = its best-matching
// source, so adding a repo can only help a project surface, never wash it out.
//
// Polymorphic over side_projects and work_experience_projects (project_kind +
// project_id), so no single FK to a project; profile_id scopes queries and
// cascades on profile delete. An attachment/project delete leaves a harmless
// orphan row that retrieval never reads (it only scores units for currently
// loaded projects). `content_hash` gates re-embedding: a stored vector is reused
// only while that unit's composed text is byte-identical, so any typed edit,
// re-summarized doc, or new commit invalidates it on the next retrieval. Vector
// stored native as jsonb and truncated to the working dim on load; the corpus is
// bounded per profile, so JS cosine — no pgvector. `model` invalidates rows when
// the embedding model changes (vectors across models are incomparable).
export const project_embeddings = pgTable("project_embeddings", {
  id: serial().primaryKey().notNull(),
  profile_id: integer().notNull(),
  source_type: varchar({ length: 16 }).notNull(), // project_typed | attachment
  project_kind: varchar({ length: 32 }).notNull(), // side_project | work_experience_project
  project_id: integer().notNull(),
  // profile_document_projects.id for an attachment unit; 0 for project_typed.
  attachment_id: integer().default(0).notNull(),
  content_hash: varchar({ length: 64 }).notNull(),
  embedding: jsonb().notNull(),
  model: varchar({ length: 100 }).notNull(),
  date_created: timestamp({ withTimezone: true, mode: "date" })
    .default(sql`now()`)
    .notNull(),
  date_updated: timestamp({ withTimezone: true, mode: "date" })
    .default(sql`now()`)
    .notNull(),
}, (table) => [
  // Upsert target: one cached vector per unit. attachment_id 0 keeps the typed
  // unit unique per project without a partial index (NULLs would not collide).
  uniqueIndex("project_embeddings_unit_key").on(
    table.project_kind,
    table.project_id,
    table.attachment_id,
  ),
  index("project_embeddings_profile_idx").on(table.profile_id),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "project_embeddings_profile_foreign",
  }).onDelete("cascade"),
]);

/**
 * Generic per-profile embedding cache for ANY content unit — the unit-type-
 * agnostic sibling of project_embeddings (Feature 5 / scale foundation). One
 * native vector per (unit_type, unit_id, sub_id) so STAR stories, cheat sheets,
 * application texts, etc. are all semantically retrievable by the unified
 * generation-context provider through the same embed/cosine/truncate/hash-cache
 * machinery. sub_id 0 is the unit itself; a positive value is a sub-unit (e.g.
 * an attachment), mirroring project_embeddings.attachment_id. Bounded per
 * profile → jsonb + JS cosine, no pgvector. Hash-gated lazy re-embed. See
 * documents/content-embeddings.ts and planning/SEMANTIC-MATCHING-AND-RAG.md.
 */
export const content_embeddings = pgTable("content_embeddings", {
  id: serial().primaryKey().notNull(),
  profile_id: integer().notNull(),
  unit_type: varchar({ length: 32 }).notNull(),
  unit_id: integer().notNull(),
  sub_id: integer().default(0).notNull(),
  content_hash: varchar({ length: 64 }).notNull(),
  embedding: jsonb().notNull(),
  model: varchar({ length: 100 }).notNull(),
  date_created: timestamp({ withTimezone: true, mode: "date" })
    .default(sql`now()`)
    .notNull(),
  date_updated: timestamp({ withTimezone: true, mode: "date" })
    .default(sql`now()`)
    .notNull(),
}, (table) => [
  // Upsert target: one cached vector per unit. sub_id 0 keeps the unit itself
  // unique per type without a partial index (NULLs would not collide). unit_type
  // is part of the key because ids only disambiguate within a type.
  uniqueIndex("content_embeddings_unit_key").on(
    table.unit_type,
    table.unit_id,
    table.sub_id,
  ),
  index("content_embeddings_profile_idx").on(table.profile_id),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "content_embeddings_profile_foreign",
  }).onDelete("cascade"),
]);

export type ContentEmbeddings = typeof content_embeddings.$inferSelect;

// Inferred select types for all application tables
export type ProfileDocumentProjects =
  typeof profile_document_projects.$inferSelect;
export type ProfileDocumentFiles = typeof profile_document_files.$inferSelect;
export type AiChatTemplates = typeof ai_chat_templates.$inferSelect;
export type AiPrompts = typeof ai_prompts.$inferSelect;
export type CollectedData = typeof collected_data.$inferSelect;
export type Config = typeof config.$inferSelect;
export type Education = typeof education.$inferSelect;
export type Highlights = typeof highlights.$inferSelect;
export type MatchConfig = typeof match_config.$inferSelect;
export type JobMatches = typeof job_matches.$inferSelect;
export type JobResources = typeof job_resources.$inferSelect;
export type SearchTaskRuns = typeof search_task_runs.$inferSelect;
export type OsContributions = typeof os_contributions.$inferSelect;
export type PlatformProfiles = typeof platform_profiles.$inferSelect;
export type PlatformCredentialsRow = typeof platform_credentials.$inferSelect;
export type Languages = typeof languages.$inferSelect;
export type JobPlatforms = typeof job_platforms.$inferSelect;
export type SearchTaskRunItems = typeof search_task_run_items.$inferSelect;
export type Jobs = typeof jobs.$inferSelect;
export type ProfileTokens = typeof profile_tokens.$inferSelect;
export type ProjectStories = typeof project_stories.$inferSelect;
export type ProfileExports = typeof profile_exports.$inferSelect;
export type References = typeof references.$inferSelect;
export type ScraperLogs = typeof scraper_logs.$inferSelect;
export type ScraperLogSteps = typeof scraper_log_steps.$inferSelect;
export type SalaryExpectations = typeof salary_expectations.$inferSelect;
export type ProfileVersions = typeof profile_versions.$inferSelect;
export type SideProjectTechnologies =
  typeof side_project_technologies.$inferSelect;
export type WorkExperienceAchievements =
  typeof work_experience_achievements.$inferSelect;
export type TechSkillTypes = typeof tech_skill_types.$inferSelect;
export type Sessions = typeof sessions.$inferSelect;
export type Verifications = typeof verifications.$inferSelect;
export type WorkExperienceProjects =
  typeof work_experience_projects.$inferSelect;
export type WorkExperienceTechnologies =
  typeof work_experience_technologies.$inferSelect;
export type Users = typeof users.$inferSelect;
export type SideProjects = typeof side_projects.$inferSelect;
export type TechSkillCategories = typeof tech_skill_categories.$inferSelect;
export type WorkExperienceProjectTechnologies =
  typeof work_experience_project_technologies.$inferSelect;
export type TechSkills = typeof tech_skills.$inferSelect;
export type Accounts = typeof accounts.$inferSelect;
export type CheatSheets = typeof cheat_sheets.$inferSelect;
export type ProfileVersionExtensions =
  typeof profile_version_extensions.$inferSelect;
export type SideProjectAchievements =
  typeof side_project_achievements.$inferSelect;
export type WorkExperiences = typeof work_experiences.$inferSelect;
export type Applications = typeof applications.$inferSelect;
export type ApiKeys = typeof api_keys.$inferSelect;
export type SearchTasks = typeof search_tasks.$inferSelect;
export type AiChats = typeof ai_chats.$inferSelect;
export type AiGenerations = typeof ai_generations.$inferSelect;
export type SearchTasksJobSites = typeof search_tasks_job_sites.$inferSelect;
export type ScraperAgentIterations =
  typeof scraper_agent_iterations.$inferSelect;
export type ScraperAgentSessions = typeof scraper_agent_sessions.$inferSelect;
export type ImportLogs = typeof import_logs.$inferSelect;
export type JobStatuses = typeof job_statuses.$inferSelect;
export type Profiles = typeof profiles.$inferSelect;
export type ApplicationLetters = typeof application_letters.$inferSelect;
export type ApplicationQuestions = typeof application_questions.$inferSelect;
export type ApplicationStatusLog = typeof application_status_log.$inferSelect;
export type ApplicationRecords = typeof application_records.$inferSelect;
export type LetterVersions = typeof letter_versions.$inferSelect;
export type QuestionVersions = typeof question_versions.$inferSelect;
export type StoryVersions = typeof story_versions.$inferSelect;
export type CheatSheetVersions = typeof cheat_sheet_versions.$inferSelect;
export type JobMatchHistory = typeof job_match_history.$inferSelect;
export type JobImporters = typeof job_importers.$inferSelect;
export type UserFeedbackFiles = typeof user_feedback_files.$inferSelect;
export type UserFeedback = typeof user_feedback.$inferSelect;
export type BillingCustomers = typeof billing_customers.$inferSelect;
export type Subscriptions = typeof subscriptions.$inferSelect;
export type CreditPurchases = typeof credit_purchases.$inferSelect;
export type UsageCounters = typeof usage_counters.$inferSelect;
export type VerificationEmailAddresses =
  typeof verification_email_addresses.$inferSelect;
export type CreditBalances = typeof credit_balances.$inferSelect;
export type CreditTransactions = typeof credit_transactions.$inferSelect;
export type Certificates = typeof certificates.$inferSelect;
export type InboundEmails = typeof inbound_emails.$inferSelect;
export type Contacts = typeof contacts.$inferSelect;
export type DeviceShares = typeof device_shares.$inferSelect;
export type DemoLinks = typeof demo_links.$inferSelect;
export type DemoLinkDevices = typeof demo_link_devices.$inferSelect;
export type FeedbackReplies = typeof feedback_replies.$inferSelect;
export type UserFeedbackSubscribers =
  typeof user_feedback_subscribers.$inferSelect;
export type Notifications = typeof notifications.$inferSelect;
export type Files = typeof files.$inferSelect;
export type SentEmails = typeof sent_emails.$inferSelect;
