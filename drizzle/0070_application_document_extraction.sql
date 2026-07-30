ALTER TABLE "applications_files" ADD COLUMN "extracted_text" text;--> statement-breakpoint
ALTER TABLE "applications_files" ADD COLUMN "extraction_status" varchar(32) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "applications_files" ADD COLUMN "extraction_error" text;--> statement-breakpoint
ALTER TABLE "applications_files" ADD COLUMN "date_extracted" timestamp with time zone;