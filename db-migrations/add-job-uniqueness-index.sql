-- Add composite index for content-based job matching
-- Jobs are now matched by title + job_poster + date_posted instead of source_url

CREATE INDEX IF NOT EXISTS idx_jobs_uniqueness
ON jobs (title, job_poster, date_posted);
