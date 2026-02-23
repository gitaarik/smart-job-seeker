-- Add is_admin flag to users table
ALTER TABLE "users" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- Create scraper_logs table for job import debugging
CREATE TABLE "scraper_logs" (
    "id" SERIAL PRIMARY KEY,
    "job_search_id" INTEGER,
    "level" VARCHAR(10) NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scraper_logs_job_search_id_fkey" FOREIGN KEY ("job_search_id")
        REFERENCES "job_searches"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Index for efficient log retrieval
CREATE INDEX "scraper_logs_job_search_id_timestamp_idx" ON "scraper_logs"("job_search_id", "timestamp");
