ALTER TABLE "ats_postings" ADD COLUMN "country_codes" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "ats_postings" ADD COLUMN "locations" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "ats_postings_country_codes_idx" ON "ats_postings" USING gin ("country_codes");