ALTER TABLE "job_importers" ADD COLUMN "source" varchar(16) DEFAULT 'task' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_importers" ADD COLUMN "shown_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "match_config" ADD COLUMN "corpus_picks_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "match_config" ADD COLUMN "corpus_picks_per_day" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
CREATE INDEX "job_importers_profile_source_idx" ON "job_importers" USING btree ("profile_id","source","date_created");--> statement-breakpoint
-- Jobs an applicant added by hand were linked as imports like any other;
-- everything else predating this column came from a task run or a scrape.
UPDATE "job_importers" ji SET "source" = 'manual'
FROM "jobs" j WHERE j."id" = ji."job_id" AND j."created_manually" = true;
