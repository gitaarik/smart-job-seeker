ALTER TABLE "job_platforms" ADD COLUMN "search_url_template" text;--> statement-breakpoint
ALTER TABLE "job_platforms" ADD COLUMN "suggestion_priority" integer;--> statement-breakpoint
ALTER TABLE "job_platforms" ADD COLUMN "suggestion_hint" text;--> statement-breakpoint

-- Seed Wellfound (not in the original platform set) and the four suggestion-
-- ready entries surfaced by /api/jobs/import/suggest. UPDATEs are guarded by
-- search_url_template IS NULL so previously-curated values are not overwritten.
INSERT INTO "job_platforms" ("status", "name", "url", "type", "key", "date_created", "date_updated")
VALUES ('draft', 'Wellfound', 'https://wellfound.com/', 'job_boards', 'wellfound', now(), now())
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint

UPDATE "job_platforms"
SET "search_url_template" = 'https://www.linkedin.com/jobs/search/?keywords={KEYWORDS}&location={LOCATION}',
    "suggestion_priority" = 1,
    "suggestion_hint" = 'Universal default. Always include unless the profile is clearly freelance/marketplace.'
WHERE "key" = 'linkedin' AND "search_url_template" IS NULL;--> statement-breakpoint

UPDATE "job_platforms"
SET "search_url_template" = 'https://www.indeed.com/jobs?q={KEYWORDS}&l={LOCATION}',
    "suggestion_priority" = 2,
    "suggestion_hint" = 'Generic fallback when LinkedIn alone feels insufficient.'
WHERE "key" = 'indeed' AND "search_url_template" IS NULL;--> statement-breakpoint

UPDATE "job_platforms"
SET "search_url_template" = 'https://weworkremotely.com/remote-jobs/search?term={KEYWORDS}',
    "suggestion_priority" = 3,
    "suggestion_hint" = 'Pick for remote-leaning profiles (remote_start_year set, "remote" in summary).'
WHERE "key" = 'we-work-remotely' AND "search_url_template" IS NULL;--> statement-breakpoint

UPDATE "job_platforms"
SET "search_url_template" = 'https://wellfound.com/jobs?role={KEYWORDS}',
    "suggestion_priority" = 4,
    "suggestion_hint" = 'Pick for tech/startup profiles or when the user shows startup interest.'
WHERE "key" = 'wellfound' AND "search_url_template" IS NULL;
