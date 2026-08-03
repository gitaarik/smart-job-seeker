ALTER TABLE "applications" ADD COLUMN "context_summary" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "context_summary_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "context_summary_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "offer_terms" jsonb;