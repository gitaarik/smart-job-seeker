ALTER TABLE "search_tasks" ADD COLUMN "search_places" jsonb;--> statement-breakpoint
ALTER TABLE "search_tasks" ADD COLUMN "search_remote_anywhere" boolean DEFAULT false NOT NULL;