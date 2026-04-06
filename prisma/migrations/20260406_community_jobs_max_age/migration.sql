-- Add configurable lookback window for community job matching.
-- When match_community_jobs is enabled, only match community jobs
-- created within this many days. NULL means no limit (all time).
-- Default 30 days for new configs; existing configs get NULL (preserve current behavior).
ALTER TABLE "match_config" ADD COLUMN "community_max_age_days" INTEGER;
