ALTER TABLE "certificates" ADD COLUMN "file_id" uuid;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_file_foreign" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "certificates_file_idx" ON "certificates" USING btree ("file_id");