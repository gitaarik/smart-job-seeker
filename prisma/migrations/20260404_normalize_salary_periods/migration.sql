-- Normalize salary_period values to canonical forms
-- Canonical values: hour, day, week, month, year, project

-- Fix case-inconsistent and alias values in jobs
UPDATE "jobs" SET "salary_period" = 'project' WHERE LOWER("salary_period") IN ('fixed-price', 'fixed price', 'one-time', 'one time');
UPDATE "jobs" SET "salary_period" = 'hour' WHERE LOWER("salary_period") IN ('hourly', 'hr', '/hr', 'p/h');
UPDATE "jobs" SET "salary_period" = 'day' WHERE LOWER("salary_period") IN ('daily', '/day');
UPDATE "jobs" SET "salary_period" = 'week' WHERE LOWER("salary_period") IN ('weekly', '/week');
UPDATE "jobs" SET "salary_period" = 'month' WHERE LOWER("salary_period") IN ('monthly', '/month', '/mo');
UPDATE "jobs" SET "salary_period" = 'year' WHERE LOWER("salary_period") IN ('yearly', 'annual', 'annually', '/year', '/yr', 'p.a.', 'per annum');

-- Same for applications
UPDATE "applications" SET "salary_period" = 'project' WHERE LOWER("salary_period") IN ('fixed-price', 'fixed price', 'one-time', 'one time');
UPDATE "applications" SET "salary_period" = 'hour' WHERE LOWER("salary_period") IN ('hourly', 'hr', '/hr', 'p/h');
UPDATE "applications" SET "salary_period" = 'day' WHERE LOWER("salary_period") IN ('daily', '/day');
UPDATE "applications" SET "salary_period" = 'week' WHERE LOWER("salary_period") IN ('weekly', '/week');
UPDATE "applications" SET "salary_period" = 'month' WHERE LOWER("salary_period") IN ('monthly', '/month', '/mo');
UPDATE "applications" SET "salary_period" = 'year' WHERE LOWER("salary_period") IN ('yearly', 'annual', 'annually', '/year', '/yr', 'p.a.', 'per annum');
