-- Refactor job_searches status fields
-- Old: status (varchar, user-configurable 'active'/'cancelled'), last_run_status, last_run_error
-- New: is_active (boolean), status (scraper state), status_message

-- Step 1: Add new columns
ALTER TABLE "job_searches" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "job_searches" ADD COLUMN "status_message" VARCHAR(255);

-- Step 2: Migrate data from old status to is_active
UPDATE "job_searches" SET "is_active" = (status = 'active' OR status IS NULL);

-- Step 3: Migrate last_run_status and last_run_error to status and status_message
UPDATE "job_searches" SET
  "status_message" = "last_run_error"
WHERE "last_run_error" IS NOT NULL;

-- Step 4: Update status column to use scraper state values
-- First, allow null and change type
ALTER TABLE "job_searches" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "job_searches" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE "job_searches" ALTER COLUMN "status" TYPE VARCHAR(50);

-- Copy last_run_status to status
UPDATE "job_searches" SET "status" = "last_run_status";

-- Step 5: Drop old columns
ALTER TABLE "job_searches" DROP COLUMN "last_run_status";
ALTER TABLE "job_searches" DROP COLUMN "last_run_error";
