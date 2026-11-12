-- The four feed platforms become pickable. 0092 inserted them as `draft`
-- because the task form then had no idea what a feed platform was and would
-- have handed them to the browser scraper. The form, the run route and the
-- worker know now (planning/ATS-FEEDS.md, Phase 2). Only rows still in draft
-- move, so an admin who hid one on purpose keeps it hidden.
UPDATE "job_platforms"
SET "status" = 'published'
WHERE "fetch_mode" = 'feed'
  AND "status" = 'draft';
