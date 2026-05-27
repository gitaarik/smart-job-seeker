CREATE TABLE "scraper_log_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"parent_step_id" integer,
	"name" text NOT NULL,
	"status" varchar(10),
	"error_message" text,
	"metadata" jsonb,
	"started_at" timestamp (6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"finished_at" timestamp (6) with time zone
);
--> statement-breakpoint
ALTER TABLE "scraper_logs" ADD COLUMN "source" varchar(20) DEFAULT 'cloud' NOT NULL;--> statement-breakpoint
ALTER TABLE "scraper_logs" ADD COLUMN "audience" varchar(10) DEFAULT 'dev' NOT NULL;--> statement-breakpoint
ALTER TABLE "scraper_logs" ADD COLUMN "step_id" integer;--> statement-breakpoint
ALTER TABLE "scraper_logs" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "scraper_log_steps" ADD CONSTRAINT "scraper_log_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."search_task_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraper_log_steps" ADD CONSTRAINT "scraper_log_steps_parent_step_id_fkey" FOREIGN KEY ("parent_step_id") REFERENCES "public"."scraper_log_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scraper_log_steps_run_id_started_idx" ON "scraper_log_steps" USING btree ("run_id" int4_ops,"started_at");--> statement-breakpoint
CREATE INDEX "scraper_log_steps_parent_idx" ON "scraper_log_steps" USING btree ("parent_step_id" int4_ops);--> statement-breakpoint
ALTER TABLE "scraper_logs" ADD CONSTRAINT "scraper_logs_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."scraper_log_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scraper_logs_step_id_idx" ON "scraper_logs" USING btree ("step_id" int4_ops);