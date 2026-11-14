-- We Work Remotely becomes a feed platform (sjs-ops planning/ATS-FEEDS.md,
-- "Job boards with their own feed"). It publishes RSS per category, which
-- together hold the whole board, and cloud's `we-work-remotely` provider
-- reads them in the nightly sweep as one board. Its terms say nothing about
-- feeds or automated access (read by Rik, 2026-11-14). Tasks on the platform
-- become feed tasks: they search what the sweep stored instead of opening
-- the site. Keyed on `key`, since the row's id differs per environment.
UPDATE "job_platforms"
SET "fetch_mode" = 'feed'
WHERE "key" = 'we-work-remotely';
--> statement-breakpoint
INSERT INTO "ats_boards" ("provider", "slug", "company_name", "source")
VALUES ('we-work-remotely', 'we-work-remotely', 'We Work Remotely', 'seed')
ON CONFLICT ("provider", "slug") DO NOTHING;
