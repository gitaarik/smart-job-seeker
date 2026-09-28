ALTER TABLE "application_records" ADD COLUMN "digest" jsonb;--> statement-breakpoint
ALTER TABLE "application_records" ADD COLUMN "digest_hash" text;--> statement-breakpoint
ALTER TABLE "application_records" ADD COLUMN "digest_at" timestamp with time zone;