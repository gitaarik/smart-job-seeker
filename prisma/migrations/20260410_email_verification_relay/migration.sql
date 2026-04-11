-- CreateTable: Unique email addresses per profile for verification email forwarding
CREATE TABLE "verification_email_addresses" (
    "id" SERIAL NOT NULL,
    "profile_id" INTEGER NOT NULL,
    "email_token" VARCHAR(64) NOT NULL,
    "full_address" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),

    CONSTRAINT "verification_email_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verification_email_addresses_email_token_key" ON "verification_email_addresses"("email_token");
CREATE UNIQUE INDEX "verification_email_addresses_profile_id_key" ON "verification_email_addresses"("profile_id");
CREATE INDEX "idx_verification_email_addresses_token" ON "verification_email_addresses"("email_token");

-- AddForeignKey
ALTER TABLE "verification_email_addresses" ADD CONSTRAINT "verification_email_addresses_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- CreateTable: Log of received verification emails
CREATE TABLE "verification_emails" (
    "id" SERIAL NOT NULL,
    "verification_address_id" INTEGER NOT NULL,
    "run_id" INTEGER,
    "from_address" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(500),
    "body_text" TEXT,
    "body_html" TEXT,
    "extracted_code" VARCHAR(50),
    "extracted_link" VARCHAR(2000),
    "status" VARCHAR(20) NOT NULL DEFAULT 'received',
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" TIMESTAMPTZ(6),

    CONSTRAINT "verification_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_verification_emails_address" ON "verification_emails"("verification_address_id");
CREATE INDEX "idx_verification_emails_run" ON "verification_emails"("run_id");
CREATE INDEX "idx_verification_emails_status" ON "verification_emails"("status");

-- AddForeignKey
ALTER TABLE "verification_emails" ADD CONSTRAINT "verification_emails_address_fkey" FOREIGN KEY ("verification_address_id") REFERENCES "verification_email_addresses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "verification_emails" ADD CONSTRAINT "verification_emails_run_fkey" FOREIGN KEY ("run_id") REFERENCES "search_task_runs"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AlterTable: Add verification_data JSON field to search_task_runs
ALTER TABLE "search_task_runs" ADD COLUMN "verification_data" JSONB;
