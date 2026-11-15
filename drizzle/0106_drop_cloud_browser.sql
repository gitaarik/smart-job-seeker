-- The GoLogin cloud browser ("hosted") is gone; a task that used it runs on the user's device.
UPDATE "search_tasks" SET "browser_provider" = 'tunnel' WHERE "browser_provider" = 'hosted';--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "rescrape_live_url";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "browser_profile_id";--> statement-breakpoint
ALTER TABLE "search_form_probe_runs" DROP COLUMN "live_url";--> statement-breakpoint
ALTER TABLE "search_task_runs" DROP COLUMN "live_url";--> statement-breakpoint
ALTER TABLE "search_tasks" DROP COLUMN "live_url";
