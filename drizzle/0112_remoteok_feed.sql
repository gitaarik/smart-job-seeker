-- Remote OK becomes a feed platform (sjs-ops planning/ATS-FEEDS.md, "Job
-- boards with their own feed"). Its browser search could not be driven, and
-- it publishes its postings at remoteok.com/api, which cloud's `remoteok`
-- provider reads in the nightly sweep as one board. Tasks on the platform
-- become feed tasks: they search what the sweep stored instead of opening
-- the site. Keyed on `key`, since the row's id differs per environment.
UPDATE "job_platforms"
SET "fetch_mode" = 'feed'
WHERE "key" = 'remoteok';
--> statement-breakpoint
INSERT INTO "ats_boards" ("provider", "slug", "company_name", "source")
VALUES ('remoteok', 'remoteok', 'Remote OK', 'seed')
ON CONFLICT ("provider", "slug") DO NOTHING;
