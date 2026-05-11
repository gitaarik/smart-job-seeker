CREATE TABLE "platform_discovery_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"discovery_run_id" integer NOT NULL,
	"level" varchar(10) NOT NULL,
	"message" text NOT NULL,
	"timestamp" timestamp (6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_discovery_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_url" text NOT NULL,
	"status" varchar(50) DEFAULT 'queued' NOT NULL,
	"started_at" timestamp (6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"finished_at" timestamp (6) with time zone,
	"error_message" text,
	"triggered_by_user_id" text,
	"bullmq_job_id" varchar(100),
	"live_url" varchar(500),
	"findings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"applied_platform_id" integer
);
--> statement-breakpoint
ALTER TABLE "platform_discovery_logs" ADD CONSTRAINT "platform_discovery_logs_run_id_fkey" FOREIGN KEY ("discovery_run_id") REFERENCES "public"."platform_discovery_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_discovery_logs_run_id_timestamp_idx" ON "platform_discovery_logs" USING btree ("discovery_run_id" int4_ops,"timestamp");