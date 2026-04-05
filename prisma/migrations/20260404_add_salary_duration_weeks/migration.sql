-- Add project duration for fixed-price/project jobs
-- Allows converting project prices to equivalent hourly rates
ALTER TABLE "jobs" ADD COLUMN "salary_duration_weeks" DOUBLE PRECISION;
