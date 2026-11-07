-- Give Dribbble and Glassdoor a keywords URL, so the scraper lands on a
-- filtered result page instead of driving their search forms.
--
-- Found 2026-11-07: on Dribbble the form flow typed into the wrong box and
-- harvested the whole board; Glassdoor redirected to its regional site and
-- dropped the keywords on the way. Both ran as successes with unfiltered
-- results. With a template, buildKeywordsUrl (cloud scraper-decisions.ts)
-- navigates straight to the filtered page, the path Upwork has used since 0010.
--
-- Data, not schema, for the reason 0010 gives: deploy runs the migrations and
-- nothing else, so a template set by hand on dev and preview leaves every other
-- environment with NULL and the broken form path. Idempotent, and a no-op where
-- the row is missing or someone has already set a template.
UPDATE "job_platforms"
SET "search_url_template" = 'https://dribbble.com/jobs?keyword={query}'
WHERE "key" = 'dribbble'
  AND "search_url_template" IS NULL;
--> statement-breakpoint
UPDATE "job_platforms"
SET "search_url_template" = 'https://www.glassdoor.com/Job/jobs.htm?sc.keyword={query}'
WHERE "key" = 'glassdoor'
  AND "search_url_template" IS NULL;
