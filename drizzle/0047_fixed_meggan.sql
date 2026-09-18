ALTER TABLE "jobs" ADD COLUMN "description_compact" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "description_compact_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "description_compact_status" varchar(50);