-- Add login_mode column to search_tasks
-- Values: 'auto' (use stored credentials), 'manual' (navigate to login page, wait for user), 'none' (skip login)
ALTER TABLE "search_tasks" ADD COLUMN "login_mode" VARCHAR(10) NOT NULL DEFAULT 'auto';
