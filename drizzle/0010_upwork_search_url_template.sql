-- Point Upwork at a keywords URL so the scraper stops driving its entry form.
--
-- Data, not schema, because deploy.sh runs `drizzle-kit migrate` and nothing
-- else: a value set by hand on dev would leave every other environment with a
-- NULL template, silently falling back to the broken form-driving path while
-- the changelog claimed the bug was fixed. See docs/DEPLOYMENT.md
-- § Post-Deploy Manual Steps for how well "someone will remember" works.
--
-- Idempotent and safe on an environment that has no Upwork row (0 rows
-- updated). Deliberately does not overwrite a template someone has already
-- set, so re-running or hand-tuning a platform stays possible.
UPDATE "job_platforms"
SET "search_url_template" = 'https://www.upwork.com/nx/search/jobs/?q={query}'
WHERE "key" = 'upwork'
  AND "search_url_template" IS NULL;
