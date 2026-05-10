ALTER TABLE "job_platforms" ADD COLUMN "success_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_platforms" ADD COLUMN "failure_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_platforms" ADD COLUMN "last_success_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_platforms" ADD COLUMN "last_failure_at" timestamp with time zone;