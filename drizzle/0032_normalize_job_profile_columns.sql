-- Normalize column naming on the four tables that still use bare
-- `job` / `profile` FK columns. Half of the *_id rename was applied during the
-- earlier Directus → Drizzle migration; this finishes it. Every other table in
-- the schema already uses *_id for FK columns.
--
-- Affected:
--   certificates.profile       → certificates.profile_id
--   job_importers.job          → job_importers.job_id
--   job_importers.profile      → job_importers.profile_id
--   job_match_history.job      → job_match_history.job_id
--   job_match_history.profile  → job_match_history.profile_id
--   job_statuses.job           → job_statuses.job_id
--   job_statuses.profile       → job_statuses.profile_id
--
-- Postgres preserves FK constraints, indices and unique constraints across
-- RENAME COLUMN (the catalog references columns by oid, not name), so no
-- ancillary fixups are needed. The constraint/index *names* still contain
-- the old "_job_" / "_profile_" tokens — left intact to keep this migration
-- small; that's cosmetic, not functional.

ALTER TABLE "certificates" RENAME COLUMN "profile" TO "profile_id";
--> statement-breakpoint
ALTER TABLE "job_importers" RENAME COLUMN "job" TO "job_id";
--> statement-breakpoint
ALTER TABLE "job_importers" RENAME COLUMN "profile" TO "profile_id";
--> statement-breakpoint
ALTER TABLE "job_match_history" RENAME COLUMN "job" TO "job_id";
--> statement-breakpoint
ALTER TABLE "job_match_history" RENAME COLUMN "profile" TO "profile_id";
--> statement-breakpoint
ALTER TABLE "job_statuses" RENAME COLUMN "job" TO "job_id";
--> statement-breakpoint
ALTER TABLE "job_statuses" RENAME COLUMN "profile" TO "profile_id";
