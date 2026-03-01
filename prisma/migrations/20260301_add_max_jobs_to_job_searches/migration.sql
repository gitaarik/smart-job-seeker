-- Add max_jobs column to job_searches
-- Allows users to configure a per-search limit on how many jobs to import
-- NULL means use the system default
ALTER TABLE "job_searches" ADD COLUMN "max_jobs" INTEGER;
