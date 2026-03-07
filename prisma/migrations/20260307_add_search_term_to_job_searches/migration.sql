-- Add search_term field to job_searches for sites that don't support query parameters in the URL
ALTER TABLE "job_searches" ADD COLUMN "search_term" VARCHAR(500);
