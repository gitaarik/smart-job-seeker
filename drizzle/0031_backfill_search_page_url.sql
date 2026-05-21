-- Backfill search_page_url on platforms that already have suggestion_priority
-- + suggestion_hint but were left without search_page_url after the URL-
-- template flow was removed. Without search_page_url the suggest endpoint
-- filters them out, so the LLM only ever sees LinkedIn.
--
-- URLs below are best-guesses based on each platform's public search page.
-- All guarded with `WHERE search_page_url IS NULL` so re-running against a
-- hand-curated prod DB won't clobber later corrections.
--
-- TODO before prod deploy: verify every URL by visiting it in a browser and
-- confirming a keyword search lands on a results page the scraper can parse.
-- Especially uncertain entries are marked "TODO verify".

UPDATE "job_platforms"
SET "search_page_url" = 'https://www.indeed.com/jobs'
WHERE "key" = 'indeed' AND "search_page_url" IS NULL;
--> statement-breakpoint

UPDATE "job_platforms"
SET "search_page_url" = 'https://weworkremotely.com/remote-jobs/search' -- TODO verify
WHERE "key" = 'we-work-remotely' AND "search_page_url" IS NULL;
--> statement-breakpoint

UPDATE "job_platforms"
SET "search_page_url" = 'https://wellfound.com/jobs'
WHERE "key" = 'wellfound' AND "search_page_url" IS NULL;
--> statement-breakpoint

UPDATE "job_platforms"
SET "search_page_url" = 'https://www.welcometothejungle.com/en/jobs'
WHERE "key" = 'welcome-to-the-jungle' AND "search_page_url" IS NULL;
--> statement-breakpoint

-- RemoteOK has no keyword search box — homepage is the listing. The hint
-- already conveys this; the scraper will need a null-keywords path.
UPDATE "job_platforms"
SET "search_page_url" = 'https://remoteok.com/' -- TODO verify (no search box)
WHERE "key" = 'remoteok' AND "search_page_url" IS NULL;
--> statement-breakpoint

UPDATE "job_platforms"
SET "search_page_url" = 'https://www.glassdoor.com/Job/index.htm' -- TODO verify
WHERE "key" = 'glassdoor-mm4zksjh' AND "search_page_url" IS NULL;
--> statement-breakpoint

-- Dribbble: hint already notes limited keyword search.
UPDATE "job_platforms"
SET "search_page_url" = 'https://dribbble.com/jobs'
WHERE "key" = 'dribbble' AND "search_page_url" IS NULL;
--> statement-breakpoint

-- Upwork: login-gated (login_page_url already set).
UPDATE "job_platforms"
SET "search_page_url" = 'https://www.upwork.com/nx/search/jobs/' -- TODO verify
WHERE "key" = 'upwork' AND "search_page_url" IS NULL;
--> statement-breakpoint

UPDATE "job_platforms"
SET "search_page_url" = 'https://builtin.com/jobs'
WHERE "key" = 'builtin' AND "search_page_url" IS NULL;
--> statement-breakpoint

UPDATE "job_platforms"
SET "search_page_url" = 'https://arc.dev/remote-jobs'
WHERE "key" = 'arc-dev' AND "search_page_url" IS NULL;
--> statement-breakpoint

-- X-Team: hint explicitly says no keyword search.
UPDATE "job_platforms"
SET "search_page_url" = 'https://x-team.com/jobs/'
WHERE "key" = 'x-team' AND "search_page_url" IS NULL;
--> statement-breakpoint

UPDATE "job_platforms"
SET "search_page_url" = 'https://www.trueup.io/jobs'
WHERE "key" = 'trueup-mnrnnhqd' AND "search_page_url" IS NULL;
