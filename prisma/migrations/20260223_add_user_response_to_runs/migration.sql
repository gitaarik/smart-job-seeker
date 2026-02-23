-- Add user_response column for dashboard feedback during scraper runs
-- Allows users to respond to intervention prompts (CAPTCHA, 2FA, job confirmation) via dashboard

ALTER TABLE "job_search_runs" ADD COLUMN "user_response" VARCHAR(20);

-- Add comment for documentation
COMMENT ON COLUMN "job_search_runs"."user_response" IS 'User response from dashboard: continue, skip, cancel (null = no response yet)';
