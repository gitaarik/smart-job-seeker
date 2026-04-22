ALTER TABLE "profiles" ADD COLUMN "email_digest_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "email_digest_frequency_days" integer DEFAULT 7;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "email_digest_min_score" integer DEFAULT 70;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "email_digest_last_sent_at" timestamp (6) with time zone;
