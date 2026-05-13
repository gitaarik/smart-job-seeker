-- Rename three tables that were introduced under the "platform discovery"
-- name and are now exposed in the schema as "search_form_probe". Earlier
-- migrations 0023/0024/0026 created platform_discovery_logs &
-- platform_discovery_runs; 0028 added platform_discovery_debug. The
-- product rename happened in code after 0028 shipped, so this migration
-- reconciles the DB names.
--
-- Idempotent: ALTER TABLE/INDEX use IF EXISTS; constraint renames live in
-- a DO block that swallows undefined_object so dev DBs (where drizzle-kit
-- push already applied the new names) can replay this without error.

ALTER TABLE IF EXISTS "platform_discovery_runs" RENAME TO "search_form_probe_runs";--> statement-breakpoint
ALTER TABLE IF EXISTS "platform_discovery_logs" RENAME TO "search_form_probe_logs";--> statement-breakpoint
ALTER TABLE IF EXISTS "platform_discovery_debug" RENAME TO "search_form_probe_debug";--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "search_form_probe_runs" RENAME CONSTRAINT "platform_discovery_runs_platform_id_fkey" TO "search_form_probe_runs_platform_id_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "search_form_probe_logs" RENAME CONSTRAINT "platform_discovery_logs_run_id_fkey" TO "search_form_probe_logs_run_id_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "search_form_probe_debug" RENAME CONSTRAINT "platform_discovery_debug_run_id_fkey" TO "search_form_probe_debug_run_id_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;--> statement-breakpoint

ALTER INDEX IF EXISTS "platform_discovery_logs_run_id_timestamp_idx" RENAME TO "search_form_probe_logs_run_id_timestamp_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "platform_discovery_debug_run_id_idx" RENAME TO "search_form_probe_debug_run_id_idx";
