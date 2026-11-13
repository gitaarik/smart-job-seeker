ALTER TABLE "match_config" ADD COLUMN "corpus_fingerprint" text;--> statement-breakpoint
ALTER TABLE "match_config" ADD COLUMN "corpus_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "match_config" ADD COLUMN "corpus_rerun_at" timestamp with time zone;