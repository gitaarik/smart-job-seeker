-- The four feed platforms leave the picker and the task suggester again:
-- corpus picks (sjs-ops planning/CORPUS-MATCHING.md, Phase 2) bring career-site
-- jobs to every profile without a task, so a task on them only duplicates that.
-- The rows stay, for `jobs.platform_id` and for the feed-run code path, and a
-- task already made on one keeps running and keeps its platform in its owner's
-- picker. Only published rows move, so 0097's reversal is exact.
UPDATE "job_platforms"
SET "status" = 'draft'
WHERE "fetch_mode" = 'feed'
  AND "status" = 'published';
