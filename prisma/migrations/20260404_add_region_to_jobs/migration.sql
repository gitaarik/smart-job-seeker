-- Add region column to jobs for salary region override matching
ALTER TABLE "jobs" ADD COLUMN "region" VARCHAR(50);

-- Create index for efficient region-based queries
CREATE INDEX "idx_jobs_region" ON "jobs" ("region");
