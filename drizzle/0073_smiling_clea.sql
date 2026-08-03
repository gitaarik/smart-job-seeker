ALTER TABLE "application_records" ADD COLUMN "file_id" uuid;--> statement-breakpoint
ALTER TABLE "application_records" ADD COLUMN "extraction_status" varchar(32) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "application_records" ADD COLUMN "extraction_error" text;--> statement-breakpoint
ALTER TABLE "application_records" ADD COLUMN "date_extracted" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "application_records" ADD COLUMN "contacts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "application_records" ADD COLUMN "source_meta" jsonb;--> statement-breakpoint
ALTER TABLE "application_records" ADD COLUMN "derived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "application_records" ADD CONSTRAINT "application_records_file_foreign" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_records_file_idx" ON "application_records" USING btree ("file_id");--> statement-breakpoint
-- Hand-added: generated migrations don't move data. `email` is renamed
-- `message` in recordTypes (a LinkedIn message is the same kind of thing as an
-- email, arriving through a different pipe), and readForm rejects any type not
-- in the vocabulary — so rows left on the old value would fail validation on
-- their next edit. See planning/APPLICATION-ACTIVITY.md.
UPDATE "application_records" SET "record_type" = 'message' WHERE "record_type" = 'email';