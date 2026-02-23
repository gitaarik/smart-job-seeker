-- Add run status tracking to job_searches
ALTER TABLE "job_searches" ADD COLUMN "last_run_status" VARCHAR(50);
ALTER TABLE "job_searches" ADD COLUMN "last_run_error" VARCHAR(255);
ALTER TABLE "job_searches" ADD COLUMN "last_run_jobs_found" INTEGER;
