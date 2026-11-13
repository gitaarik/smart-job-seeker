ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp (6) with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_reason" text;