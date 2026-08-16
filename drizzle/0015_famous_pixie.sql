ALTER TABLE "search_task_runs" ADD COLUMN "failure_kind" varchar(32);--> statement-breakpoint
ALTER TABLE "search_tasks" ADD COLUMN "auth_block_kind" varchar(32);--> statement-breakpoint
ALTER TABLE "search_tasks" ADD COLUMN "auth_block_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "search_tasks" ADD COLUMN "auto_disabled_at" timestamp with time zone;