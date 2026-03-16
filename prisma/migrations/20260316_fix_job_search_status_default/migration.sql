-- Set default value for status column
ALTER TABLE "job_searches" ALTER COLUMN "status" SET DEFAULT 'idle';

-- Backfill: tasks that have run before but have null status → set to last meaningful state
-- Tasks with a last_run but null status were likely successful in the past
UPDATE "job_searches" SET "status" = 'success' WHERE "status" IS NULL AND "last_run" IS NOT NULL;

-- Tasks that have never run and have null status → set to idle
UPDATE "job_searches" SET "status" = 'idle' WHERE "status" IS NULL AND "last_run" IS NULL;
