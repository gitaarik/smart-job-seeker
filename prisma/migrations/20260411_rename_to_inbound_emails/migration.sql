-- Rename verification_emails → inbound_emails and add generic fields

-- Add new columns first (before rename, so constraints reference correct table)
ALTER TABLE "verification_emails" ADD COLUMN "recipient" VARCHAR(255);
ALTER TABLE "verification_emails" ADD COLUMN "handler" VARCHAR(50);

-- Backfill recipient from the linked verification address
UPDATE "verification_emails" ve
SET "recipient" = vea."full_address"
FROM "verification_email_addresses" vea
WHERE ve."verification_address_id" = vea."id";

-- Backfill handler
UPDATE "verification_emails" SET "handler" = 'verification-relay' WHERE "handler" IS NULL;

-- Make recipient NOT NULL now that it's backfilled
ALTER TABLE "verification_emails" ALTER COLUMN "recipient" SET NOT NULL;

-- Make verification_address_id nullable (not all inbound emails are verification)
ALTER TABLE "verification_emails" ALTER COLUMN "verification_address_id" DROP NOT NULL;

-- Drop old FK constraint (will be re-created with new table name)
ALTER TABLE "verification_emails" DROP CONSTRAINT "verification_emails_address_fkey";
ALTER TABLE "verification_emails" DROP CONSTRAINT "verification_emails_run_fkey";

-- Drop old indexes
DROP INDEX "idx_verification_emails_address";
DROP INDEX "idx_verification_emails_run";
DROP INDEX "idx_verification_emails_status";

-- Rename table
ALTER TABLE "verification_emails" RENAME TO "inbound_emails";

-- Rename PK constraint
ALTER TABLE "inbound_emails" RENAME CONSTRAINT "verification_emails_pkey" TO "inbound_emails_pkey";

-- Re-create FK constraints with new names
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_address_fkey"
  FOREIGN KEY ("verification_address_id") REFERENCES "verification_email_addresses"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_run_fkey"
  FOREIGN KEY ("run_id") REFERENCES "search_task_runs"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

-- Re-create indexes with new names
CREATE INDEX "idx_inbound_emails_address" ON "inbound_emails"("verification_address_id");
CREATE INDEX "idx_inbound_emails_run" ON "inbound_emails"("run_id");
CREATE INDEX "idx_inbound_emails_status" ON "inbound_emails"("status");
CREATE INDEX "idx_inbound_emails_handler" ON "inbound_emails"("handler");
CREATE INDEX "idx_inbound_emails_received" ON "inbound_emails"("received_at");
