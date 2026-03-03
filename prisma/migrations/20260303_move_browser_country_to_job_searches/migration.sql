-- Move browser_country_code from profiles to job_searches.
-- Per-search-task browser geo override; profile's country_code is the default.

-- Add to job_searches
ALTER TABLE "job_searches" ADD COLUMN "browser_country_code" VARCHAR(10);

-- Migrate existing values: copy from profile to all its job_searches
UPDATE "job_searches" js
SET "browser_country_code" = p."browser_country_code"
FROM "profiles" p
WHERE js."profile" = p."id"
  AND p."browser_country_code" IS NOT NULL;

-- Drop from profiles
ALTER TABLE "profiles" DROP COLUMN "browser_country_code";
