-- Add optional note field to search_tasks
ALTER TABLE "search_tasks" ADD COLUMN IF NOT EXISTS "note" VARCHAR(500);

-- Copy existing name values into note (only non-empty ones that weren't already migrated)
UPDATE "search_tasks" SET "note" = "name" WHERE "name" IS NOT NULL AND "name" != '' AND "note" IS NULL;

-- Drop the name column (platform name is now the primary identifier)
ALTER TABLE "search_tasks" DROP COLUMN IF EXISTS "name";
