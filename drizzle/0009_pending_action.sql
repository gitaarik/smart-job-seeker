-- Add pending_action JSONB column to search_task_runs.
-- Carries dashboard-driven actions (type-text, navigate-url, submit, clear)
-- the scraper executes during its intervention wait, plus the resulting
-- status/result for the dashboard to read back.
ALTER TABLE "search_task_runs" ADD COLUMN "pending_action" jsonb;
