CREATE TABLE "ats_boards" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" varchar(32) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"company_name" varchar(255),
	"status" varchar(16) DEFAULT 'live' NOT NULL,
	"source" varchar(16) DEFAULT 'seed' NOT NULL,
	"created_by_user_id" text,
	"posting_count" integer DEFAULT 0 NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_ok_at" timestamp with time zone,
	"last_error" text,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ats_postings" (
	"id" serial PRIMARY KEY NOT NULL,
	"board_id" integer NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"title" varchar(512) NOT NULL,
	"company_name" varchar(255),
	"location_text" varchar(512),
	"city" varchar(255),
	"country_code" varchar(2),
	"work_location" varchar(16),
	"employment_type" varchar(32),
	"hours_commitment" varchar(16),
	"experience_level" varchar(16),
	"hours_min" integer,
	"hours_max" integer,
	"salary_min" integer,
	"salary_max" integer,
	"salary_currency" varchar(8),
	"salary_period" varchar(16),
	"department" varchar(255),
	"content_html" text,
	"content_text" text NOT NULL,
	"apply_url" varchar(2048),
	"source_url" varchar(2048) NOT NULL,
	"published_at" timestamp with time zone,
	"provider_updated_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"job_id" integer,
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("company_name", '') || ' ' || coalesce("content_text", ''))) STORED
);
--> statement-breakpoint
ALTER TABLE "job_platforms" ADD COLUMN "fetch_mode" varchar(16) DEFAULT 'browser' NOT NULL;--> statement-breakpoint
ALTER TABLE "ats_boards" ADD CONSTRAINT "ats_boards_created_by_user_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ats_postings" ADD CONSTRAINT "ats_postings_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."ats_boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ats_postings" ADD CONSTRAINT "ats_postings_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ats_boards_provider_slug_unique" ON "ats_boards" USING btree ("provider","slug");--> statement-breakpoint
CREATE INDEX "ats_boards_status_idx" ON "ats_boards" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ats_postings_board_external_unique" ON "ats_postings" USING btree ("board_id","external_id");--> statement-breakpoint
CREATE INDEX "ats_postings_tsv_idx" ON "ats_postings" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "ats_postings_published_at_idx" ON "ats_postings" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "ats_postings_country_code_idx" ON "ats_postings" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "ats_postings_closed_at_idx" ON "ats_postings" USING btree ("closed_at");--> statement-breakpoint
CREATE INDEX "ats_postings_job_id_idx" ON "ats_postings" USING btree ("job_id");--> statement-breakpoint
-- The four feed platforms. Data in a migration for the reason 0010 and 0084
-- give: deploy runs the migrations and nothing else, and GO-LIVE lists
-- job_platforms seeding as undone for a first production deploy. `draft` until
-- Phase 2 of planning/ATS-FEEDS.md gives a feed platform its own task form; as
-- `published` the picker would offer them to the browser scraper today.
-- Idempotent: a row someone already made keeps its values.
INSERT INTO "job_platforms" ("key", "name", "url", "type", "status", "fetch_mode", "date_created")
VALUES
	('greenhouse', 'Greenhouse', 'https://boards.greenhouse.io/', 'job_boards', 'draft', 'feed', now()),
	('lever', 'Lever', 'https://jobs.lever.co/', 'job_boards', 'draft', 'feed', now()),
	('ashby', 'Ashby', 'https://jobs.ashbyhq.com/', 'job_boards', 'draft', 'feed', now()),
	('recruitee', 'Recruitee', 'https://recruitee.com/', 'job_boards', 'draft', 'feed', now())
ON CONFLICT ("key") DO NOTHING;
