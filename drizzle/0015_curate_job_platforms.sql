-- Curation pass on job_platforms: clean up the existing four suggestable
-- entries, expand the pool with a few existing rows that fit, and add new
-- platforms worth surfacing. Everything is idempotent so re-running on a
-- prod DB that's been hand-curated won't clobber existing work.
--
-- Suggestion pool after this migration (in priority order):
--   1. LinkedIn  — universal default
--   2. Indeed  — generic fallback
--   3. We Work Remotely  — remote-leaning profiles
--   4. Wellfound  — tech/startup profiles
--   5. Welcome to the Jungle  — Europe-leaning tech profiles
--   6. RemoteOK  — remote-only tech (alternative to WWR)
--   7. Glassdoor  — generic US fallback with company context
--   8. Dribbble  — designer profiles (UX/UI/visual)
--   9. Upwork  — freelance/contract profiles
--  10. Built In  — US tech (startups/scale-ups)
--
-- Vetted marketplaces (Toptal, Mercor, Turing, BairesDev, Andela, micro1,
-- cord, X-Team, Gigster, Lumenalta, Gun.io, alignerr, trueup, Arc.dev,
-- SvelteJobs, Freelance.nl) intentionally stay out of the suggestion pool —
-- they require manual application/login flows that don't fit the URL-driven
-- scrape model. Their rows still exist for grouping and platform metadata.

-- 1. Clean up LinkedIn's hint (it picked up a "[test edit at ...]" suffix
--    during admin UI testing on dev — guard so prod isn't affected).
UPDATE "job_platforms"
SET "suggestion_hint" = 'Universal default. Always include unless the profile is clearly freelance/marketplace.'
WHERE "key" = 'linkedin'
  AND "suggestion_hint" LIKE '%[test edit%';
--> statement-breakpoint

-- 2. Promote Wellfound from draft → published; we're surfacing it via the
--    suggest endpoint so it should be a normal active platform.
UPDATE "job_platforms"
SET "status" = 'published'
WHERE "key" = 'wellfound' AND "status" = 'draft';
--> statement-breakpoint

-- 3. Welcome to the Jungle (new) — Europe-leaning tech jobs.
INSERT INTO "job_platforms"
  ("status", "name", "url", "type", "key", "search_url_template",
   "suggestion_priority", "suggestion_hint", "date_created", "date_updated")
VALUES
  ('published', 'Welcome to the Jungle', 'https://www.welcometothejungle.com/',
   'job_boards', 'welcome-to-the-jungle',
   'https://www.welcometothejungle.com/en/jobs?query={KEYWORDS}&aroundQuery={LOCATION}',
   5,
   'Europe-leaning tech profiles. Strong company-culture context.',
   now(), now())
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint

-- 4. RemoteOK (new) — remote-only tech, alternative audience to WWR.
INSERT INTO "job_platforms"
  ("status", "name", "url", "type", "key", "search_url_template",
   "suggestion_priority", "suggestion_hint", "date_created", "date_updated")
VALUES
  ('published', 'RemoteOK', 'https://remoteok.com/',
   'job_boards', 'remoteok',
   'https://remoteok.com/?q={KEYWORDS}',
   6,
   'Remote-only tech roles. Pair with We Work Remotely for broader remote coverage.',
   now(), now())
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint

-- 5. Glassdoor — promote the auto-created row (key has hash suffix because
--    it was auto-detected from a URL paste). Update by id to keep it stable.
UPDATE "job_platforms"
SET "search_url_template" = 'https://www.glassdoor.com/Job/jobs.htm?sc.keyword={KEYWORDS}&locKeyword={LOCATION}',
    "suggestion_priority" = 7,
    "suggestion_hint" = 'Generic US-leaning fallback. Strong company-review context — useful when the user cares about culture/comp signals.',
    "type" = 'job_boards'
WHERE "key" = 'glassdoor-mm4zksjh' AND "search_url_template" IS NULL;
--> statement-breakpoint

-- 6. Dribbble (new) — design jobs.
INSERT INTO "job_platforms"
  ("status", "name", "url", "type", "key", "search_url_template",
   "suggestion_priority", "suggestion_hint", "date_created", "date_updated")
VALUES
  ('published', 'Dribbble Jobs', 'https://dribbble.com/jobs',
   'job_boards', 'dribbble',
   'https://dribbble.com/jobs?location={LOCATION}',
   8,
   'Designer profiles (UX/UI/visual/product design). Skip for non-design profiles. Search-by-keyword limited; uses location filter.',
   now(), now())
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint

-- 7. Upwork — freelance/contract.
UPDATE "job_platforms"
SET "search_url_template" = 'https://www.upwork.com/nx/search/jobs/?q={KEYWORDS}',
    "suggestion_priority" = 9,
    "suggestion_hint" = 'Freelance/contract profiles, or when the profile mentions consulting/contract work. Login-gated for full results.'
WHERE "key" = 'upwork' AND "search_url_template" IS NULL;
--> statement-breakpoint

-- 8. Built In (new) — US tech, startups/scale-ups.
INSERT INTO "job_platforms"
  ("status", "name", "url", "type", "key", "search_url_template",
   "suggestion_priority", "suggestion_hint", "date_created", "date_updated")
VALUES
  ('published', 'Built In', 'https://builtin.com/',
   'job_boards', 'builtin',
   'https://builtin.com/jobs?search={KEYWORDS}',
   10,
   'US tech roles with strong startup/scale-up mix. Pair well with Wellfound when the profile is US + tech + startup-leaning.',
   now(), now())
ON CONFLICT ("key") DO NOTHING;
