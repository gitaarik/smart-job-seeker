ALTER TABLE "search_tasks" ADD COLUMN IF NOT EXISTS "debug_screenshots" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scraper_logs" ADD COLUMN IF NOT EXISTS "screenshot_path" varchar(255);
