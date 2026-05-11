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
  type PgTableExtraConfigValue,
  pgSequence,
  pgTable,
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
export const directus_activity_id_seq = pgSequence("directus_activity_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const directus_activity_id_seq1 = pgSequence(
  "directus_activity_id_seq1",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const directus_activity_id_seq2 = pgSequence(
  "directus_activity_id_seq2",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const directus_activity_id_seq3 = pgSequence(
  "directus_activity_id_seq3",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const directus_notifications_id_seq = pgSequence(
  "directus_notifications_id_seq",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const directus_notifications_id_seq1 = pgSequence(
  "directus_notifications_id_seq1",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const directus_notifications_id_seq2 = pgSequence(
  "directus_notifications_id_seq2",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const directus_notifications_id_seq3 = pgSequence(
  "directus_notifications_id_seq3",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const directus_presets_id_seq = pgSequence("directus_presets_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const directus_presets_id_seq1 = pgSequence("directus_presets_id_seq1", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const directus_presets_id_seq2 = pgSequence("directus_presets_id_seq2", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const directus_presets_id_seq3 = pgSequence("directus_presets_id_seq3", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});
export const directus_revisions_id_seq = pgSequence(
  "directus_revisions_id_seq",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const directus_revisions_id_seq1 = pgSequence(
  "directus_revisions_id_seq1",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const directus_revisions_id_seq2 = pgSequence(
  "directus_revisions_id_seq2",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const directus_revisions_id_seq3 = pgSequence(
  "directus_revisions_id_seq3",
  {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
  },
);
export const highlights_id_seq = pgSequence("highlights_id_seq", {
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
  user_created: uuid(),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  user_updated: uuid(),
  name: varchar({ length: 255 }),
  status: varchar({ length: 255 }).default("draft"),
  description: text(),
  system_prompt: text(),
  messages: json(),
}, (table) => [
  index().using("btree", table.name.asc().nullsLast().op("text_ops")),
  uniqueIndex("ai_prompts_name_unique").using(
    "btree",
    table.name.asc().nullsLast().op("text_ops"),
  ),
  foreignKey({
    columns: [table.user_created],
    foreignColumns: [directus_users.id],
    name: "ai_prompts_user_created_foreign",
  }),
  foreignKey({
    columns: [table.user_updated],
    foreignColumns: [directus_users.id],
    name: "ai_prompts_user_updated_foreign",
  }),
]);

export const application_activity_log = pgTable("application_activity_log", {
  id: serial().primaryKey().notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  date: date(),
  title: varchar({ length: 255 }),
  note: text(),
  application_id: integer(),
}, (table) => [
  foreignKey({
    columns: [table.application_id],
    foreignColumns: [applications.id],
    name: "application_activity_log_application_foreign",
  }).onDelete("cascade"),
]);

export const applications_files = pgTable("applications_files", {
  id: serial().primaryKey().notNull(),
  applications_id: integer(),
  file_id: uuid(),
}, (table) => [
  foreignKey({
    columns: [table.applications_id],
    foreignColumns: [applications.id],
    name: "applications_files_applications_id_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.file_id],
    foreignColumns: [files.id],
    name: "applications_files_file_id_foreign",
  }).onDelete("set null"),
]);

export const collected_data = pgTable("collected_data", {
  id: serial().primaryKey().notNull(),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  schema: text(),
  data: text(),
  profile_id: integer(),
}, (table) => [
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "collected_data_profile_foreign",
  }).onDelete("cascade"),
]);

export const directus_comments = pgTable("directus_comments", {
  id: uuid().primaryKey().notNull(),
  collection: varchar({ length: 64 }).notNull(),
  item: varchar({ length: 255 }).notNull(),
  comment: text().notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`),
  user_created: uuid(),
  user_updated: uuid(),
}, (table) => [
  foreignKey({
    columns: [table.user_created],
    foreignColumns: [directus_users.id],
    name: "directus_comments_user_created_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.user_updated],
    foreignColumns: [directus_users.id],
    name: "directus_comments_user_updated_foreign",
  }),
]);

export const directus_dashboards = pgTable("directus_dashboards", {
  id: uuid().primaryKey().notNull(),
  name: varchar({ length: 255 }).notNull(),
  icon: varchar({ length: 64 }).default("dashboard").notNull(),
  note: text(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`),
  user_created: uuid(),
  color: varchar({ length: 255 }),
}, (table) => [
  foreignKey({
    columns: [table.user_created],
    foreignColumns: [directus_users.id],
    name: "directus_dashboards_user_created_foreign",
  }).onDelete("set null"),
]);

export const directus_deployments = pgTable("directus_deployments", {
  id: uuid().primaryKey().notNull(),
  provider: varchar({ length: 255 }).notNull(),
  credentials: text(),
  options: text(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`),
  user_created: uuid(),
}, (table) => [
  uniqueIndex("directus_deployments_provider_unique").using(
    "btree",
    table.provider.asc().nullsLast().op("text_ops"),
  ),
  foreignKey({
    columns: [table.user_created],
    foreignColumns: [directus_users.id],
    name: "directus_deployments_user_created_foreign",
  }).onDelete("set null"),
]);

export const directus_deployment_runs = pgTable("directus_deployment_runs", {
  id: uuid().primaryKey().notNull(),
  project: uuid().notNull(),
  external_id: varchar({ length: 255 }).notNull(),
  target: varchar({ length: 255 }).notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`),
  user_created: uuid(),
}, (table) => [
  foreignKey({
    columns: [table.project],
    foreignColumns: [directus_deployment_projects.id],
    name: "directus_deployment_runs_project_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.user_created],
    foreignColumns: [directus_users.id],
    name: "directus_deployment_runs_user_created_foreign",
  }).onDelete("set null"),
]);

export const directus_activity = pgTable("directus_activity", {
  id: serial().primaryKey().notNull(),
  action: varchar({ length: 45 }).notNull(),
  user: uuid(),
  timestamp: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
  ip: varchar({ length: 50 }),
  user_agent: text(),
  collection: varchar({ length: 64 }).notNull(),
  item: varchar({ length: 255 }).notNull(),
  origin: varchar({ length: 255 }),
}, (table) => [
  index().using(
    "btree",
    table.timestamp.asc().nullsLast().op("timestamptz_ops"),
  ),
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

export const directus_access = pgTable("directus_access", {
  id: uuid().primaryKey().notNull(),
  role: uuid(),
  user: uuid(),
  policy: uuid().notNull(),
  sort: integer(),
}, (table) => [
  foreignKey({
    columns: [table.policy],
    foreignColumns: [directus_policies.id],
    name: "directus_access_policy_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.role],
    foreignColumns: [directus_roles.id],
    name: "directus_access_role_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.user],
    foreignColumns: [directus_users.id],
    name: "directus_access_user_foreign",
  }).onDelete("cascade"),
]);

export const directus_collections = pgTable("directus_collections", {
  collection: varchar({ length: 64 }).primaryKey().notNull(),
  icon: varchar({ length: 64 }),
  note: text(),
  display_template: varchar({ length: 255 }),
  hidden: boolean().default(false).notNull(),
  singleton: boolean().default(false).notNull(),
  translations: json(),
  archive_field: varchar({ length: 64 }),
  archive_app_filter: boolean().default(true).notNull(),
  archive_value: varchar({ length: 255 }),
  unarchive_value: varchar({ length: 255 }),
  sort_field: varchar({ length: 64 }),
  accountability: varchar({ length: 255 }).default("all"),
  color: varchar({ length: 255 }),
  item_duplication_fields: json(),
  sort: integer(),
  group: varchar({ length: 64 }),
  collapse: varchar({ length: 255 }).default("open").notNull(),
  preview_url: varchar({ length: 255 }),
  versioning: boolean().default(false).notNull(),
}, (table) => [
  foreignKey({
    columns: [table.group],
    foreignColumns: [table.collection],
    name: "directus_collections_group_foreign",
  }),
]);

export const directus_extensions = pgTable("directus_extensions", {
  enabled: boolean().default(true).notNull(),
  id: uuid().primaryKey().notNull(),
  folder: varchar({ length: 255 }).notNull(),
  source: varchar({ length: 255 }).notNull(),
  bundle: uuid(),
});

export const directus_fields = pgTable("directus_fields", {
  id: serial().primaryKey().notNull(),
  collection: varchar({ length: 64 }).notNull(),
  field: varchar({ length: 64 }).notNull(),
  special: varchar({ length: 64 }),
  interface: varchar({ length: 64 }),
  options: json(),
  display: varchar({ length: 64 }),
  display_options: json(),
  readonly: boolean().default(false).notNull(),
  hidden: boolean().default(false).notNull(),
  sort: integer(),
  width: varchar({ length: 30 }).default("full"),
  translations: json(),
  note: text(),
  conditions: json(),
  required: boolean().default(false),
  group: varchar({ length: 64 }),
  validation: json(),
  validation_message: text(),
  searchable: boolean().default(true).notNull(),
});

export const directus_folders = pgTable("directus_folders", {
  id: uuid().primaryKey().notNull(),
  name: varchar({ length: 255 }).notNull(),
  parent: uuid(),
}, (table) => [
  foreignKey({
    columns: [table.parent],
    foreignColumns: [table.id],
    name: "directus_folders_parent_foreign",
  }),
]);

export const directus_notifications = pgTable("directus_notifications", {
  id: serial().primaryKey().notNull(),
  timestamp: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`),
  status: varchar({ length: 255 }).default("inbox"),
  recipient: uuid().notNull(),
  sender: uuid(),
  subject: varchar({ length: 255 }).notNull(),
  message: text(),
  collection: varchar({ length: 64 }),
  item: varchar({ length: 255 }),
}, (table) => [
  foreignKey({
    columns: [table.recipient],
    foreignColumns: [directus_users.id],
    name: "directus_notifications_recipient_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.sender],
    foreignColumns: [directus_users.id],
    name: "directus_notifications_sender_foreign",
  }),
]);

export const directus_migrations = pgTable("directus_migrations", {
  version: varchar({ length: 255 }).primaryKey().notNull(),
  name: varchar({ length: 255 }).notNull(),
  timestamp: timestamp({ withTimezone: true, mode: "date" }).default(
    sql`CURRENT_TIMESTAMP`,
  ),
});

export const directus_flows = pgTable("directus_flows", {
  id: uuid().primaryKey().notNull(),
  name: varchar({ length: 255 }).notNull(),
  icon: varchar({ length: 64 }),
  color: varchar({ length: 255 }),
  description: text(),
  status: varchar({ length: 255 }).default("active").notNull(),
  trigger: varchar({ length: 255 }),
  accountability: varchar({ length: 255 }).default("all"),
  options: json(),
  operation: uuid(),
  date_created: timestamp({ withTimezone: true, mode: "date" }).default(
    sql`CURRENT_TIMESTAMP`,
  ),
  user_created: uuid(),
}, (table) => [
  foreignKey({
    columns: [table.user_created],
    foreignColumns: [directus_users.id],
    name: "directus_flows_user_created_foreign",
  }).onDelete("set null"),
  unique("directus_flows_operation_unique").on(table.operation),
]);

export const directus_presets = pgTable("directus_presets", {
  id: serial().primaryKey().notNull(),
  bookmark: varchar({ length: 255 }),
  user: uuid(),
  role: uuid(),
  collection: varchar({ length: 64 }),
  search: varchar({ length: 100 }),
  layout: varchar({ length: 100 }).default("tabular"),
  layout_query: json(),
  layout_options: json(),
  refresh_interval: integer(),
  filter: json(),
  icon: varchar({ length: 64 }).default("bookmark"),
  color: varchar({ length: 255 }),
}, (table) => [
  foreignKey({
    columns: [table.role],
    foreignColumns: [directus_roles.id],
    name: "directus_presets_role_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.user],
    foreignColumns: [directus_users.id],
    name: "directus_presets_user_foreign",
  }).onDelete("cascade"),
]);

export const directus_panels = pgTable("directus_panels", {
  id: uuid().primaryKey().notNull(),
  dashboard: uuid().notNull(),
  name: varchar({ length: 255 }),
  icon: varchar({ length: 64 }),
  color: varchar({ length: 10 }),
  show_header: boolean().default(false).notNull(),
  note: text(),
  type: varchar({ length: 255 }).notNull(),
  position_x: integer().notNull(),
  position_y: integer().notNull(),
  width: integer().notNull(),
  height: integer().notNull(),
  options: json(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`),
  user_created: uuid(),
}, (table) => [
  foreignKey({
    columns: [table.dashboard],
    foreignColumns: [directus_dashboards.id],
    name: "directus_panels_dashboard_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.user_created],
    foreignColumns: [directus_users.id],
    name: "directus_panels_user_created_foreign",
  }).onDelete("set null"),
]);

export const directus_revisions = pgTable("directus_revisions", {
  id: serial().primaryKey().notNull(),
  activity: integer().notNull(),
  collection: varchar({ length: 64 }).notNull(),
  item: varchar({ length: 255 }).notNull(),
  data: json(),
  delta: json(),
  parent: integer(),
  version: uuid(),
}, (table) => [
  index().using("btree", table.activity.asc().nullsLast().op("int4_ops")),
  index().using("btree", table.parent.asc().nullsLast().op("int4_ops")),
  foreignKey({
    columns: [table.activity],
    foreignColumns: [directus_activity.id],
    name: "directus_revisions_activity_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.parent],
    foreignColumns: [table.id],
    name: "directus_revisions_parent_foreign",
  }),
  foreignKey({
    columns: [table.version],
    foreignColumns: [directus_versions.id],
    name: "directus_revisions_version_foreign",
  }).onDelete("cascade"),
]);

export const directus_relations = pgTable("directus_relations", {
  id: serial().primaryKey().notNull(),
  many_collection: varchar({ length: 64 }).notNull(),
  many_field: varchar({ length: 64 }).notNull(),
  one_collection: varchar({ length: 64 }),
  one_field: varchar({ length: 64 }),
  one_collection_field: varchar({ length: 64 }),
  one_allowed_collections: text(),
  junction_field: varchar({ length: 64 }),
  sort_field: varchar({ length: 64 }),
  one_deselect_action: varchar({ length: 255 }).default("nullify").notNull(),
});

export const directus_permissions = pgTable("directus_permissions", {
  id: serial().primaryKey().notNull(),
  collection: varchar({ length: 64 }).notNull(),
  action: varchar({ length: 10 }).notNull(),
  permissions: json(),
  validation: json(),
  presets: json(),
  fields: text(),
  policy: uuid().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.policy],
    foreignColumns: [directus_policies.id],
    name: "directus_permissions_policy_foreign",
  }).onDelete("cascade"),
]);

export const directus_versions = pgTable("directus_versions", {
  id: uuid().primaryKey().notNull(),
  key: varchar({ length: 64 }).notNull(),
  name: varchar({ length: 255 }),
  collection: varchar({ length: 64 }).notNull(),
  item: varchar({ length: 255 }).notNull(),
  hash: varchar({ length: 255 }),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`),
  date_updated: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`),
  user_created: uuid(),
  user_updated: uuid(),
  delta: json(),
}, (table) => [
  foreignKey({
    columns: [table.collection],
    foreignColumns: [directus_collections.collection],
    name: "directus_versions_collection_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.user_created],
    foreignColumns: [directus_users.id],
    name: "directus_versions_user_created_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.user_updated],
    foreignColumns: [directus_users.id],
    name: "directus_versions_user_updated_foreign",
  }),
]);

export const directus_settings = pgTable("directus_settings", {
  id: serial().primaryKey().notNull(),
  project_name: varchar({ length: 100 }).default("Directus").notNull(),
  project_url: varchar({ length: 255 }),
  project_color: varchar({ length: 255 }).default("#6644FF").notNull(),
  project_logo: uuid(),
  public_foreground: uuid(),
  public_background: uuid(),
  public_note: text(),
  auth_login_attempts: integer().default(25),
  auth_password_policy: varchar({ length: 100 }),
  storage_asset_transform: varchar({ length: 7 }).default("all"),
  storage_asset_presets: json(),
  custom_css: text(),
  storage_default_folder: uuid(),
  basemaps: json(),
  mapbox_key: varchar({ length: 255 }),
  module_bar: json(),
  project_descriptor: varchar({ length: 100 }),
  default_language: varchar({ length: 255 }).default("en-US").notNull(),
  custom_aspect_ratios: json(),
  public_favicon: uuid(),
  default_appearance: varchar({ length: 255 }).default("auto").notNull(),
  default_theme_light: varchar({ length: 255 }),
  theme_light_overrides: json(),
  default_theme_dark: varchar({ length: 255 }),
  theme_dark_overrides: json(),
  report_error_url: varchar({ length: 255 }),
  report_bug_url: varchar({ length: 255 }),
  report_feature_url: varchar({ length: 255 }),
  public_registration: boolean().default(false).notNull(),
  public_registration_verify_email: boolean().default(true).notNull(),
  public_registration_role: uuid(),
  public_registration_email_filter: json(),
  visual_editor_urls: json(),
  project_id: uuid(),
  mcp_enabled: boolean().default(false).notNull(),
  mcp_allow_deletes: boolean().default(false).notNull(),
  mcp_prompts_collection: varchar({ length: 255 }),
  mcp_system_prompt_enabled: boolean().default(true).notNull(),
  mcp_system_prompt: text(),
  project_owner: varchar({ length: 255 }),
  project_usage: varchar({ length: 255 }),
  org_name: varchar({ length: 255 }),
  product_updates: boolean(),
  project_status: varchar({ length: 255 }),
  ai_openai_api_key: text(),
  ai_anthropic_api_key: text(),
  ai_system_prompt: text(),
  ai_google_api_key: text(),
  ai_openai_compatible_api_key: text(),
  ai_openai_compatible_base_url: text(),
  ai_openai_compatible_name: text(),
  ai_openai_compatible_models: json(),
  ai_openai_compatible_headers: json(),
  ai_openai_allowed_models: json(),
  ai_anthropic_allowed_models: json(),
  ai_google_allowed_models: json(),
  collaborative_editing_enabled: boolean().default(false).notNull(),
}, (table) => [
  foreignKey({
    columns: [table.project_logo],
    foreignColumns: [files.id],
    name: "directus_settings_project_logo_foreign",
  }),
  foreignKey({
    columns: [table.public_background],
    foreignColumns: [files.id],
    name: "directus_settings_public_background_foreign",
  }),
  foreignKey({
    columns: [table.public_favicon],
    foreignColumns: [files.id],
    name: "directus_settings_public_favicon_foreign",
  }),
  foreignKey({
    columns: [table.public_foreground],
    foreignColumns: [files.id],
    name: "directus_settings_public_foreground_foreign",
  }),
  foreignKey({
    columns: [table.public_registration_role],
    foreignColumns: [directus_roles.id],
    name: "directus_settings_public_registration_role_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.storage_default_folder],
    foreignColumns: [directus_folders.id],
    name: "directus_settings_storage_default_folder_foreign",
  }).onDelete("set null"),
]);

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

export const directus_translations = pgTable("directus_translations", {
  id: uuid().primaryKey().notNull(),
  language: varchar({ length: 255 }).notNull(),
  key: varchar({ length: 255 }).notNull(),
  value: text().notNull(),
});

export const directus_roles = pgTable("directus_roles", {
  id: uuid().primaryKey().notNull(),
  name: varchar({ length: 100 }).notNull(),
  icon: varchar({ length: 64 }).default("supervised_user_circle").notNull(),
  description: text(),
  parent: uuid(),
}, (table) => [
  foreignKey({
    columns: [table.parent],
    foreignColumns: [table.id],
    name: "directus_roles_parent_foreign",
  }),
]);

export const directus_shares = pgTable("directus_shares", {
  id: uuid().primaryKey().notNull(),
  name: varchar({ length: 255 }),
  collection: varchar({ length: 64 }).notNull(),
  item: varchar({ length: 255 }).notNull(),
  role: uuid(),
  password: varchar({ length: 255 }),
  user_created: uuid(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`),
  date_start: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  date_end: timestamp({ precision: 6, withTimezone: true, mode: "date" }),
  times_used: integer().default(0),
  max_uses: integer(),
}, (table) => [
  foreignKey({
    columns: [table.collection],
    foreignColumns: [directus_collections.collection],
    name: "directus_shares_collection_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.role],
    foreignColumns: [directus_roles.id],
    name: "directus_shares_role_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.user_created],
    foreignColumns: [directus_users.id],
    name: "directus_shares_user_created_foreign",
  }).onDelete("set null"),
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
}, (table) => [
  index("job_matches_profile_id_job_id_idx").using(
    "btree",
    table.profile_id.asc().nullsLast().op("int4_ops"),
    table.job_id.asc().nullsLast().op("int4_ops"),
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

export const directus_users = pgTable("directus_users", {
  id: uuid().primaryKey().notNull(),
  first_name: varchar({ length: 50 }),
  last_name: varchar({ length: 50 }),
  email: varchar({ length: 128 }),
  password: varchar({ length: 255 }),
  location: varchar({ length: 255 }),
  title: varchar({ length: 50 }),
  description: text(),
  tags: json(),
  avatar: uuid(),
  language: varchar({ length: 255 }),
  tfa_secret: varchar({ length: 255 }),
  status: varchar({ length: 16 }).default("active").notNull(),
  role: uuid(),
  token: varchar({ length: 255 }),
  last_access: timestamp({ withTimezone: true, mode: "date" }),
  last_page: varchar({ length: 255 }),
  provider: varchar({ length: 128 }).default("default").notNull(),
  external_identifier: varchar({ length: 255 }),
  auth_data: json(),
  email_notifications: boolean().default(true),
  appearance: varchar({ length: 255 }),
  theme_dark: varchar({ length: 255 }),
  theme_light: varchar({ length: 255 }),
  theme_light_overrides: json(),
  theme_dark_overrides: json(),
  text_direction: varchar({ length: 255 }).default("auto").notNull(),
}, (table) => [
  foreignKey({
    columns: [table.role],
    foreignColumns: [directus_roles.id],
    name: "directus_users_role_foreign",
  }).onDelete("set null"),
  unique("directus_users_email_unique").on(table.email),
  unique("directus_users_token_unique").on(table.token),
  unique("directus_users_external_identifier_unique").on(
    table.external_identifier,
  ),
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
}, (table) => [
  index("search_task_runs_search_task_id_started_at_idx").using(
    "btree",
    table.search_task_id.asc().nullsLast().op("int4_ops"),
    table.started_at.asc().nullsLast().op("int4_ops"),
  ),
  foreignKey({
    columns: [table.search_task_id],
    foreignColumns: [search_tasks.id],
    name: "search_task_runs_search_task_id_fkey",
  }).onDelete("cascade"),
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

export const platform_profiles = pgTable("platform_profiles", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("signup_in_progress").notNull(),
  sort: integer(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  profile_id: integer().notNull(),
  platform_id: integer(),
  username: varchar({ length: 255 }),
  password: text(),
  api_token: text(),
  last_login_at: timestamp({ withTimezone: true, mode: "date" }),
  login_error: text(),
  provider_profile_id: varchar({ length: 255 }),
  security_answer: text(),
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
  // Search URL template with {KEYWORDS} and {LOCATION} placeholders. Null
  // means the platform doesn't expose search via URL params (e.g. login-
  // gated marketplaces) — suggest_import_tasks won't propose URL-flow
  // tasks for those.
  search_url_template: text(),
  // suggest_import_tasks sort order: 1 = top, null = not in the suggestable
  // pool. Curated manually so we can tune which platforms get surfaced first.
  suggestion_priority: integer(),
  // Short hint passed to the LLM as part of the platforms list, telling it
  // when to pick this platform (e.g. "remote-leaning profiles", "tech/startup").
  suggestion_hint: text(),
  // Phase 1 usage signals — incremented when a search_task_run on this
  // platform reaches a terminal state. See planning/JOB-PLATFORM-SIGNALS.md
  // for the full multi-phase plan. Phase 1 only collects raw counts; the
  // suggest endpoint still uses suggestion_priority for ordering. Phase 3
  // shifts to score-driven selection.
  success_count: integer().default(0).notNull(),
  failure_count: integer().default(0).notNull(),
  last_success_at: timestamp({ withTimezone: true, mode: "date" }),
  last_failure_at: timestamp({ withTimezone: true, mode: "date" }),
}, (table) => [
  unique("job_platforms_key_unique").on(table.key),
]);

// Per-platform "search presets" — canonical, ready-to-use URLs (or URL
// templates with {KEYWORDS}/{LOCATION} placeholders) that the AI suggest
// endpoint picks from. Replaces the single search_url_template column on
// job_platforms, which couldn't handle platforms with multiple URL formats
// (LinkedIn's remote-filter, last-24h, etc.) or path-slug platforms
// (Wellfound's /role/{slug}) cleanly.
//
// Each preset is either:
//  - a template with {KEYWORDS} and/or {LOCATION} placeholders (server
//    substitutes URL-encoded values from the LLM response), or
//  - a literal URL with no placeholders (used as-is — landing-only flows
//    like X-Team's /jobs/ listings, or fixed path slugs like Wellfound's
//    /role/python-developer).
//
// Signals migrate to per-preset granularity: which preset succeeded /
// failed is more informative than which platform did. The platform-level
// signal columns on job_platforms remain for aggregate dashboards.
export const job_platform_search_presets = pgTable("job_platform_search_presets", {
  id: serial().primaryKey().notNull(),
  platform_id: integer().notNull(),
  label: varchar({ length: 128 }).notNull(),
  url_template: text().notNull(),
  applicable_hint: text(),
  // Per-preset filter configuration. Each entry is either:
  //   - single-select: { multi: false, options: { value_key: url_fragment } }
  //     where url_fragment is a complete "key=value" string appended to the URL.
  //   - multi-select:  { multi: true, param: "<key>", sep: ",", options: { value_key: raw_value } }
  //     where the chosen values are joined by `sep` and appended as `param=val1,val2`.
  // Filter names are drawn from a small canonical taxonomy (sort_by,
  // time_posted, work_location, job_type) so the picker UI can label them
  // consistently across platforms. Empty object = no filters for this preset.
  params: jsonb().$type<Record<
    string,
    | { multi: false; options: Record<string, string> }
    | {
      multi: true;
      param: string;
      sep: string;
      options: Record<string, string>;
    }
  >>().default({}).notNull(),
  // suggestion ordering within a platform; null = not in suggest pool.
  suggestion_priority: integer(),
  success_count: integer().default(0).notNull(),
  failure_count: integer().default(0).notNull(),
  last_success_at: timestamp({ withTimezone: true, mode: "date" }),
  last_failure_at: timestamp({ withTimezone: true, mode: "date" }),
  date_created: timestamp({ withTimezone: true, mode: "date" }).defaultNow().notNull(),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
}, (table) => [
  foreignKey({
    columns: [table.platform_id],
    foreignColumns: [job_platforms.id],
    name: "job_platform_search_presets_platform_id_fk",
  }).onDelete("cascade"),
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
  changed_at: timestamp({ withTimezone: true, mode: "date" }).defaultNow().notNull(),
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
  index("idx_search_task_run_items_run_id").using(
    "btree",
    table.run_id.asc().nullsLast().op("int4_ops"),
  ),
  index("idx_search_task_run_items_run_status").using(
    "btree",
    table.run_id.asc().nullsLast().op("int4_ops"),
    table.status.asc().nullsLast().op("int4_ops"),
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
}, (table) => [
  index("idx_jobs_uniqueness").using(
    "btree",
    table.title.asc().nullsLast().op("date_ops"),
    table.job_poster.asc().nullsLast().op("date_ops"),
    table.date_posted.asc().nullsLast().op("text_ops"),
  ),
  index("jobs_source_url_idx").using(
    "btree",
    table.source_url.asc().nullsLast().op("text_ops"),
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
    table.token_hash.asc().nullsLast().op("text_ops"),
  ),
  uniqueIndex("profile_tokens_token_unique").using(
    "btree",
    table.token.asc().nullsLast().op("text_ops"),
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
}, (table) => [
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
export const platform_discovery_runs = pgTable("platform_discovery_runs", {
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
  /** Credential to use for login, drawn from platform_profiles. Optional —
   *  if null, discovery proceeds without login (and gated sites may fail
   *  to expose their jobs link). */
  platform_profile_id: integer(),
  /** Device (api_keys row) the discovery should run on. Optional — if
   *  null, the worker uses the default browser provider. Setting this
   *  routes the session through the tunnel to the user's local browser. */
  sjsbrowser_api_key_id: integer(),
  bullmq_job_id: varchar({ length: 100 }),
  live_url: varchar({ length: 500 }),
  /** Draft output from the worker. Shape:
   *   { platform_name, platform_key, login_page_url, search_page_url,
   *     search_url_template, applicable_hint, notes[] } */
  findings: jsonb().$type<{
    platform_name?: string;
    platform_key?: string;
    login_page_url?: string | null;
    search_page_url?: string | null;
    search_url_template?: string | null;
    applicable_hint?: string | null;
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
    name: "platform_discovery_runs_platform_id_fkey",
  }).onDelete("cascade"),
]);

/**
 * Worker-emitted log lines for a platform-discovery run. Parallels
 * scraper_logs (which is keyed to search_task_runs).
 */
export const platform_discovery_logs = pgTable("platform_discovery_logs", {
  id: serial().primaryKey().notNull(),
  discovery_run_id: integer().notNull(),
  level: varchar({ length: 10 }).notNull(),
  message: text().notNull(),
  timestamp: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("platform_discovery_logs_run_id_timestamp_idx").using(
    "btree",
    table.discovery_run_id.asc().nullsLast().op("int4_ops"),
    table.timestamp.asc().nullsLast(),
  ),
  foreignKey({
    columns: [table.discovery_run_id],
    foreignColumns: [platform_discovery_runs.id],
    name: "platform_discovery_logs_run_id_fkey",
  }).onDelete("cascade"),
]);

export const scraper_logs = pgTable("scraper_logs", {
  id: serial().primaryKey().notNull(),
  run_id: integer().notNull(),
  level: varchar({ length: 10 }).notNull(),
  message: text().notNull(),
  timestamp: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("scraper_logs_run_id_timestamp_idx").using(
    "btree",
    table.run_id.asc().nullsLast().op("int4_ops"),
    table.timestamp.asc().nullsLast().op("int4_ops"),
  ),
  foreignKey({
    columns: [table.run_id],
    foreignColumns: [search_task_runs.id],
    name: "scraper_logs_run_id_fkey",
  }).onDelete("cascade"),
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
    table.slug.asc().nullsLast().op("text_ops"),
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
    table.token.asc().nullsLast().op("text_ops"),
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
  stars: integer(),
  summary: text(),
  url_label: varchar({ length: 255 }),
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
}, (table) => [
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
}, (table) => [
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "cheat_sheets_profile_foreign",
  }).onDelete("cascade"),
]);

export const directus_policies = pgTable("directus_policies", {
  id: uuid().primaryKey().notNull(),
  name: varchar({ length: 100 }).notNull(),
  icon: varchar({ length: 64 }).default("badge").notNull(),
  description: text(),
  ip_access: text(),
  enforce_tfa: boolean().default(false).notNull(),
  admin_access: boolean().default(false).notNull(),
  app_access: boolean().default(false).notNull(),
});

export const directus_deployment_projects = pgTable(
  "directus_deployment_projects",
  {
    id: uuid().primaryKey().notNull(),
    deployment: uuid().notNull(),
    external_id: varchar({ length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
      .default(sql`CURRENT_TIMESTAMP`),
    user_created: uuid(),
  },
  (table) => [
    uniqueIndex("directus_deployment_projects_deployment_external_id_unique")
      .using(
        "btree",
        table.deployment.asc().nullsLast().op("text_ops"),
        table.external_id.asc().nullsLast().op("text_ops"),
      ),
    foreignKey({
      columns: [table.deployment],
      foreignColumns: [directus_deployments.id],
      name: "directus_deployment_projects_deployment_foreign",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.user_created],
      foreignColumns: [directus_users.id],
      name: "directus_deployment_projects_user_created_foreign",
    }).onDelete("set null"),
  ],
);

export const directus_operations = pgTable("directus_operations", {
  id: uuid().primaryKey().notNull(),
  name: varchar({ length: 255 }),
  key: varchar({ length: 255 }).notNull(),
  type: varchar({ length: 255 }).notNull(),
  position_x: integer().notNull(),
  position_y: integer().notNull(),
  options: json(),
  resolve: uuid(),
  reject: uuid(),
  flow: uuid().notNull(),
  date_created: timestamp({ withTimezone: true, mode: "date" }).default(
    sql`CURRENT_TIMESTAMP`,
  ),
  user_created: uuid(),
}, (table) => [
  foreignKey({
    columns: [table.flow],
    foreignColumns: [directus_flows.id],
    name: "directus_operations_flow_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.reject],
    foreignColumns: [table.id],
    name: "directus_operations_reject_foreign",
  }),
  foreignKey({
    columns: [table.resolve],
    foreignColumns: [table.id],
    name: "directus_operations_resolve_foreign",
  }),
  foreignKey({
    columns: [table.user_created],
    foreignColumns: [directus_users.id],
    name: "directus_operations_user_created_foreign",
  }).onDelete("set null"),
  unique("directus_operations_resolve_unique").on(table.resolve),
  unique("directus_operations_reject_unique").on(table.reject),
]);

export const directus_sessions = pgTable("directus_sessions", {
  token: varchar({ length: 64 }).primaryKey().notNull(),
  user: uuid(),
  expires: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .notNull(),
  ip: varchar({ length: 255 }),
  user_agent: text(),
  share: uuid(),
  origin: varchar({ length: 255 }),
  next_token: varchar({ length: 64 }),
}, (table) => [
  foreignKey({
    columns: [table.share],
    foreignColumns: [directus_shares.id],
    name: "directus_sessions_share_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.user],
    foreignColumns: [directus_users.id],
    name: "directus_sessions_user_foreign",
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
}, (table) => [
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
  }),
]);

export const api_keys = pgTable("api_keys", {
  id: serial().primaryKey().notNull(),
  profile_id: integer().notNull(),
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
    table.key_hash.asc().nullsLast().op("text_ops"),
  ),
  index("idx_api_keys_hash").using(
    "btree",
    table.key_hash.asc().nullsLast().op("text_ops"),
  ),
  index("idx_api_keys_profile").using(
    "btree",
    table.profile_id.asc().nullsLast().op("int4_ops"),
  ),
  foreignKey({
    columns: [table.profile_id],
    foreignColumns: [profiles.id],
    name: "api_keys_profile_foreign",
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
  // When the task was created from an AI-suggested preset, link back to the
  // preset row so we can attribute success/failure signals to the preset
  // (not just the platform). Null means "custom URL not derived from a
  // preset" — the platform-level signal is the only attribution we have.
  preset_id: integer(),
  // Plain (un-URL-encoded) location string the user picked when creating
  // the task from a preset whose template has a {LOCATION} placeholder.
  // Persisted separately so the edit form can show it as a structured
  // field instead of having to parse it back out of search_url. Null for
  // older tasks created before this column existed; the edit form falls
  // back to the URL when re-rendering.
  search_location: text(),
  // User-selected filter values for this task. For single-select filters
  // the value is a string value_key, e.g. { sort_by: "newest" }; for
  // multi-select filters it's an array, e.g. { work_location: ["remote",
  // "hybrid"] }. The preset's params jsonb declares which filter is which
  // and how each value_key maps to a URL fragment.
  search_filters: jsonb().$type<Record<string, string | string[]>>().default({}).notNull(),
}, (table) => [
  index("idx_search_tasks_platform_profile").using(
    "btree",
    table.platform_profile_id.asc().nullsLast().op("int4_ops"),
  ),
  // Partial index on preset_id so ON DELETE SET NULL doesn't seq-scan
  // when an admin deletes a preset; most tasks have null preset_id
  // (custom URLs) so the partial form is much smaller than a full index.
  index("idx_search_tasks_preset_id")
    .on(table.preset_id)
    .where(sql`${table.preset_id} IS NOT NULL`),
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
    columns: [table.preset_id],
    foreignColumns: [job_platform_search_presets.id],
    name: "search_tasks_preset_id_fk",
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
    table.session_id.asc().nullsLast().op("int4_ops"),
    table.iteration.asc().nullsLast().op("int4_ops"),
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
    table.search_task_id.asc().nullsLast().op("int4_ops"),
  ),
  index("scraper_agent_sessions_status_idx").using(
    "btree",
    table.status.asc().nullsLast().op("text_ops"),
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
    table.date_created.asc().nullsLast().op("timestamptz_ops"),
  ),
  index("import_logs_user_id_idx").using(
    "btree",
    table.user_id.asc().nullsLast().op("text_ops"),
  ),
]);

export const job_statuses = pgTable("job_statuses", {
  id: serial().primaryKey().notNull(),
  status: varchar({ length: 255 }).default("new").notNull(),
  date_created: timestamp({ withTimezone: true, mode: "date" }),
  date_updated: timestamp({ withTimezone: true, mode: "date" }),
  job: integer().notNull(),
  profile: integer().notNull(),
}, (table) => [
  uniqueIndex("job_statuses_profile_job_key").using(
    "btree",
    table.profile.asc().nullsLast().op("int4_ops"),
    table.job.asc().nullsLast().op("int4_ops"),
  ),
  index("job_statuses_profile_status_idx").using(
    "btree",
    table.profile.asc().nullsLast().op("int4_ops"),
    table.status.asc().nullsLast().op("text_ops"),
  ),
  foreignKey({
    columns: [table.job],
    foreignColumns: [jobs.id],
    name: "job_statuses_job_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.profile],
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
    table.user_id.asc().nullsLast().op("text_ops"),
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

export const job_match_history = pgTable("job_match_history", {
  id: serial().primaryKey().notNull(),
  job: integer().notNull(),
  profile: integer().notNull(),
  score: integer().default(0).notNull(),
  skill_match_percentage: integer(),
  recommendation: varchar({ length: 255 }),
  match_summary: text(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .defaultNow(),
}, (table) => [
  index("job_match_history_date_idx").using(
    "btree",
    table.job.asc().nullsLast().op("int4_ops"),
    table.date_created.desc().nullsFirst().op("int4_ops"),
  ),
  index("job_match_history_profile_job_idx").using(
    "btree",
    table.profile.asc().nullsLast().op("int4_ops"),
    table.job.asc().nullsLast().op("int4_ops"),
  ),
  foreignKey({
    columns: [table.job],
    foreignColumns: [jobs.id],
    name: "job_match_history_job_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.profile],
    foreignColumns: [profiles.id],
    name: "job_match_history_profile_foreign",
  }).onDelete("cascade"),
]);

export const job_importers = pgTable("job_importers", {
  id: serial().primaryKey().notNull(),
  date_created: timestamp({ withTimezone: true, mode: "date" }).default(
    sql`CURRENT_TIMESTAMP`,
  ),
  job: integer().notNull(),
  profile: integer().notNull(),
}, (table) => [
  uniqueIndex("job_importers_job_profile_unique").using(
    "btree",
    table.job.asc().nullsLast().op("int4_ops"),
    table.profile.asc().nullsLast().op("int4_ops"),
  ),
  foreignKey({
    columns: [table.job],
    foreignColumns: [jobs.id],
    name: "job_importers_job_foreign",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.profile],
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
    table.user_feedback_id.asc().nullsLast().op("int4_ops"),
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
    table.category.asc().nullsLast().op("text_ops"),
  ),
  index("user_feedback_date_created_idx").using(
    "btree",
    table.date_created.asc().nullsLast().op("timestamptz_ops"),
  ),
  index("user_feedback_merged_into_idx").using(
    "btree",
    table.merged_into_id.asc().nullsLast().op("int4_ops"),
  ),
  index("user_feedback_status_idx").using(
    "btree",
    table.status.asc().nullsLast().op("text_ops"),
  ),
  index("user_feedback_user_id_idx").using(
    "btree",
    table.user_id.asc().nullsLast().op("text_ops"),
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
    table.status.asc().nullsLast().op("text_ops"),
  ),
  index("subscriptions_user_id_idx").using(
    "btree",
    table.user_id.asc().nullsLast().op("text_ops"),
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
    table.user_id.asc().nullsLast().op("text_ops"),
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
    table.period.asc().nullsLast().op("text_ops"),
  ),
  index("usage_counters_user_id_idx").using(
    "btree",
    table.user_id.asc().nullsLast().op("text_ops"),
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
    index("idx_verification_email_addresses_token").using(
      "btree",
      table.email_token.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("verification_email_addresses_email_token_key").using(
      "btree",
      table.email_token.asc().nullsLast().op("text_ops"),
    ),
    uniqueIndex("verification_email_addresses_profile_id_key").using(
      "btree",
      table.profile_id.asc().nullsLast().op("int4_ops"),
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
  index("credit_balances_user_id_idx").using(
    "btree",
    table.user_id.asc().nullsLast().op("text_ops"),
  ),
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
    table.operation.asc().nullsLast().op("text_ops"),
  ),
  index("credit_transactions_user_id_created_idx").using(
    "btree",
    table.user_id.asc().nullsLast().op("text_ops"),
    table.created_at.asc().nullsLast().op("text_ops"),
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
  profile: integer().notNull(),
}, (table) => [
  index("idx_certificates_profile").using(
    "btree",
    table.profile.asc().nullsLast().op("int4_ops"),
  ),
  foreignKey({
    columns: [table.profile],
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
    table.verification_address_id.asc().nullsLast().op("int4_ops"),
  ),
  index("idx_inbound_emails_handler").using(
    "btree",
    table.handler.asc().nullsLast().op("text_ops"),
  ),
  index("idx_inbound_emails_received").using(
    "btree",
    table.received_at.asc().nullsLast().op("timestamptz_ops"),
  ),
  index("idx_inbound_emails_run").using(
    "btree",
    table.run_id.asc().nullsLast().op("int4_ops"),
  ),
  index("idx_inbound_emails_status").using(
    "btree",
    table.status.asc().nullsLast().op("text_ops"),
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
    table.type.asc().nullsLast().op("text_ops"),
  ),
  index("idx_sent_emails_status").using(
    "btree",
    table.status.asc().nullsLast().op("text_ops"),
  ),
  index("idx_sent_emails_sent_at").using(
    "btree",
    table.sent_at.asc().nullsLast().op("timestamptz_ops"),
  ),
  index("idx_sent_emails_user").using(
    "btree",
    table.user_id.asc().nullsLast().op("text_ops"),
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
    table.requester_id.asc().nullsLast().op("text_ops"),
    table.recipient_id.asc().nullsLast().op("text_ops"),
  ),
  index("idx_contacts_recipient").using(
    "btree",
    table.recipient_id.asc().nullsLast().op("text_ops"),
  ),
  index("idx_contacts_requester").using(
    "btree",
    table.requester_id.asc().nullsLast().op("text_ops"),
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

export const credential_shares = pgTable("credential_shares", {
  id: serial().primaryKey().notNull(),
  platform_profile_id: integer().notNull(),
  shared_with: text().notNull(),
  date_created: timestamp({ precision: 6, withTimezone: true, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("credential_shares_pp_user_unique").using(
    "btree",
    table.platform_profile_id.asc().nullsLast().op("int4_ops"),
    table.shared_with.asc().nullsLast().op("text_ops"),
  ),
  index("idx_credential_shares_pp").using(
    "btree",
    table.platform_profile_id.asc().nullsLast().op("int4_ops"),
  ),
  index("idx_credential_shares_shared_with").using(
    "btree",
    table.shared_with.asc().nullsLast().op("text_ops"),
  ),
  foreignKey({
    columns: [table.shared_with],
    foreignColumns: [users.id],
    name: "credential_shares_shared_with_fkey",
  }).onDelete("cascade"),
  foreignKey({
    columns: [table.platform_profile_id],
    foreignColumns: [platform_profiles.id],
    name: "credential_shares_platform_profile_id_fkey",
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
    table.api_key_id.asc().nullsLast().op("text_ops"),
    table.shared_with.asc().nullsLast().op("int4_ops"),
  ),
  index("idx_device_shares_api_key").using(
    "btree",
    table.api_key_id.asc().nullsLast().op("int4_ops"),
  ),
  index("idx_device_shares_shared_with").using(
    "btree",
    table.shared_with.asc().nullsLast().op("text_ops"),
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
    table.feedback_id.asc().nullsLast().op("int4_ops"),
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
    table.feedback_id.asc().nullsLast().op("int4_ops"),
    table.user_id.asc().nullsLast().op("int4_ops"),
  ),
  index("user_feedback_subscribers_user_idx").using(
    "btree",
    table.user_id.asc().nullsLast().op("text_ops"),
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
  index("notifications_user_id_idx").using(
    "btree",
    table.user_id.asc().nullsLast().op("text_ops"),
  ),
  index("notifications_user_unread_idx").using(
    "btree",
    table.user_id.asc().nullsLast().op("text_ops"),
    table.read_at.asc().nullsLast().op("text_ops"),
  ),
]);

export const files = pgTable("files", {
  id: uuid().primaryKey().notNull(),
  storage: varchar({ length: 255 }).notNull(),
  filename_disk: varchar({ length: 255 }),
  filename_download: varchar({ length: 255 }).notNull(),
  title: varchar({ length: 255 }),
  type: varchar({ length: 255 }),
  folder: uuid(),
  uploaded_by: uuid(),
  modified_by: uuid(),
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
}, (table) => [
  foreignKey({
    columns: [table.folder],
    foreignColumns: [directus_folders.id],
    name: "directus_files_folder_foreign",
  }).onDelete("set null"),
  foreignKey({
    columns: [table.modified_by],
    foreignColumns: [directus_users.id],
    name: "directus_files_modified_by_foreign",
  }),
  foreignKey({
    columns: [table.uploaded_by],
    foreignColumns: [directus_users.id],
    name: "directus_files_uploaded_by_foreign",
  }),
]);

// Inferred select types for all application tables
export type AiChatTemplates = typeof ai_chat_templates.$inferSelect;
export type AiPrompts = typeof ai_prompts.$inferSelect;
export type ApplicationActivityLog =
  typeof application_activity_log.$inferSelect;
export type ApplicationsFiles = typeof applications_files.$inferSelect;
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
export type Languages = typeof languages.$inferSelect;
export type JobPlatforms = typeof job_platforms.$inferSelect;
export type SearchTaskRunItems = typeof search_task_run_items.$inferSelect;
export type Jobs = typeof jobs.$inferSelect;
export type ProfileTokens = typeof profile_tokens.$inferSelect;
export type ProjectStories = typeof project_stories.$inferSelect;
export type ProfileExports = typeof profile_exports.$inferSelect;
export type References = typeof references.$inferSelect;
export type ScraperLogs = typeof scraper_logs.$inferSelect;
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
export type LetterVersions = typeof letter_versions.$inferSelect;
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
export type FeedbackReplies = typeof feedback_replies.$inferSelect;
export type UserFeedbackSubscribers =
  typeof user_feedback_subscribers.$inferSelect;
export type Notifications = typeof notifications.$inferSelect;
export type Files = typeof files.$inferSelect;
export type SentEmails = typeof sent_emails.$inferSelect;
