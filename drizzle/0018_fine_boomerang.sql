CREATE TABLE "job_platform_search_presets" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform_id" integer NOT NULL,
	"label" varchar(128) NOT NULL,
	"url_template" text NOT NULL,
	"applicable_hint" text,
	"suggestion_priority" integer,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "job_platform_search_presets" ADD CONSTRAINT "job_platform_search_presets_platform_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."job_platforms"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Seed canonical presets per platform. Idempotent: each preset is only
-- inserted if no preset already exists for the (platform_id, label) pair.
-- Templates may have {KEYWORDS} and/or {LOCATION} placeholders which the
-- server URL-encodes and substitutes; literal URLs (no placeholders) are
-- used as-is.

-- LinkedIn: multiple useful URL formats.
INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Generic search',
  'https://www.linkedin.com/jobs/search/?keywords={KEYWORDS}&location={LOCATION}',
  'Default for any profile. Returns recent + older listings.', 1
FROM "job_platforms" WHERE "key" = 'linkedin'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Generic search'
);
--> statement-breakpoint

INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Remote only',
  'https://www.linkedin.com/jobs/search/?keywords={KEYWORDS}&f_WT=2',
  'Pick when the profile is strongly remote-leaning (remote_start_year set, "remote" in summary). Filters to remote roles only — drop the location parameter.', 2
FROM "job_platforms" WHERE "key" = 'linkedin'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Remote only'
);
--> statement-breakpoint

INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Last 24 hours',
  'https://www.linkedin.com/jobs/search/?keywords={KEYWORDS}&location={LOCATION}&f_TPR=r86400',
  'Pick when the user wants only freshly-posted jobs. Narrower; only use if profile signals urgency.', 3
FROM "job_platforms" WHERE "key" = 'linkedin'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Last 24 hours'
);
--> statement-breakpoint

-- Indeed
INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Generic search',
  'https://www.indeed.com/jobs?q={KEYWORDS}&l={LOCATION}',
  'Default Indeed search. Use as a broad fallback when LinkedIn alone feels insufficient.', 1
FROM "job_platforms" WHERE "key" = 'indeed'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Generic search'
);
--> statement-breakpoint

-- We Work Remotely
INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Generic search',
  'https://weworkremotely.com/remote-jobs/search?term={KEYWORDS}',
  'Use for remote-only profiles. URL has no location filter — remote is the entire premise of the site.', 1
FROM "job_platforms" WHERE "key" = 'we-work-remotely'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Generic search'
);
--> statement-breakpoint

-- Wellfound uses path-based role slugs from a fixed list. Seed common ones;
-- admins can add more via the admin UI. Each preset is a literal URL with
-- no placeholders — the LLM picks the slug that matches the profile.
INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Software engineer',
  'https://wellfound.com/role/software-engineer',
  'Generic tech profile, full-stack or backend leaning. Default pick for engineers.', 1
FROM "job_platforms" WHERE "key" = 'wellfound'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Software engineer'
);
--> statement-breakpoint

INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Python developer',
  'https://wellfound.com/role/python-developer',
  'Profile prominently features Python in skills/work experience.', 2
FROM "job_platforms" WHERE "key" = 'wellfound'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Python developer'
);
--> statement-breakpoint

INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'JavaScript developer',
  'https://wellfound.com/role/javascript-developer',
  'Profile features JavaScript/TypeScript prominently.', 3
FROM "job_platforms" WHERE "key" = 'wellfound'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'JavaScript developer'
);
--> statement-breakpoint

INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Frontend developer',
  'https://wellfound.com/role/frontend-developer',
  'Profile shows frontend-leaning stack (React, Vue, Svelte, CSS, design systems).', 4
FROM "job_platforms" WHERE "key" = 'wellfound'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Frontend developer'
);
--> statement-breakpoint

INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Backend developer',
  'https://wellfound.com/role/backend-developer',
  'Profile shows backend-leaning stack (APIs, databases, distributed systems).', 5
FROM "job_platforms" WHERE "key" = 'wellfound'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Backend developer'
);
--> statement-breakpoint

INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Data scientist',
  'https://wellfound.com/role/data-scientist',
  'Profile features data analysis, ML, statistics, or research backgrounds.', 6
FROM "job_platforms" WHERE "key" = 'wellfound'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Data scientist'
);
--> statement-breakpoint

INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Machine learning engineer',
  'https://wellfound.com/role/machine-learning-engineer',
  'Profile features ML/AI engineering, model deployment, MLOps.', 7
FROM "job_platforms" WHERE "key" = 'wellfound'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Machine learning engineer'
);
--> statement-breakpoint

INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Product designer',
  'https://wellfound.com/role/product-designer',
  'Profile is design-leaning (UX, UI, product, visual). Don''t pick for pure engineering profiles.', 8
FROM "job_platforms" WHERE "key" = 'wellfound'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Product designer'
);
--> statement-breakpoint

INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Product manager',
  'https://wellfound.com/role/product-manager',
  'Profile shows product management, strategy, roadmapping experience.', 9
FROM "job_platforms" WHERE "key" = 'wellfound'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Product manager'
);
--> statement-breakpoint

INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'DevOps engineer',
  'https://wellfound.com/role/devops-engineer',
  'Profile features infrastructure, CI/CD, Kubernetes, cloud platforms, SRE.', 10
FROM "job_platforms" WHERE "key" = 'wellfound'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'DevOps engineer'
);
--> statement-breakpoint

-- Welcome to the Jungle
INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Generic search',
  'https://www.welcometothejungle.com/en/jobs?query={KEYWORDS}&aroundQuery={LOCATION}',
  'Europe-leaning tech roles, especially France/Germany/Spain/UK.', 1
FROM "job_platforms" WHERE "key" = 'welcome-to-the-jungle'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Generic search'
);
--> statement-breakpoint

-- RemoteOK
INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Generic search',
  'https://remoteok.com/?q={KEYWORDS}',
  'Remote-only tech roles. No location filter — site is remote by default.', 1
FROM "job_platforms" WHERE "key" = 'remoteok'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Generic search'
);
--> statement-breakpoint

-- Glassdoor
INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Generic search',
  'https://www.glassdoor.com/Job/jobs.htm?sc.keyword={KEYWORDS}&locKeyword={LOCATION}',
  'US-leaning generic search. Strong company-review context.', 1
FROM "job_platforms" WHERE "key" = 'glassdoor-mm4zksjh'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Generic search'
);
--> statement-breakpoint

-- Dribbble: location-only filter, no keyword search.
INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'All design jobs',
  'https://dribbble.com/jobs?location={LOCATION}',
  'Designer profiles only (UX/UI/visual). No keyword filter — surfaces all design jobs at the given location.', 1
FROM "job_platforms" WHERE "key" = 'dribbble'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'All design jobs'
);
--> statement-breakpoint

-- Upwork
INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Generic search',
  'https://www.upwork.com/nx/search/jobs/?q={KEYWORDS}',
  'Freelance/contract profiles. Login-gated for full results but the search URL works publicly.', 1
FROM "job_platforms" WHERE "key" = 'upwork'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Generic search'
);
--> statement-breakpoint

-- Built In
INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Generic search',
  'https://builtin.com/jobs?search={KEYWORDS}',
  'US tech roles, startup/scale-up focused.', 1
FROM "job_platforms" WHERE "key" = 'builtin'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Generic search'
);
--> statement-breakpoint

-- Arc.dev
INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Generic search',
  'https://arc.dev/remote-jobs?search={KEYWORDS}',
  'Vetted remote tech jobs. Broad applicant pool, curated listings.', 1
FROM "job_platforms" WHERE "key" = 'arc-dev'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Generic search'
);
--> statement-breakpoint

-- X-Team: no search, just the listings page.
INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'All listings',
  'https://x-team.com/jobs/',
  'Remote dev contracts via X-Team. No URL-level search; user sees the full listings page.', 1
FROM "job_platforms" WHERE "key" = 'x-team'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'All listings'
);
--> statement-breakpoint

-- trueup.io
INSERT INTO "job_platform_search_presets"
  ("platform_id", "label", "url_template", "applicable_hint", "suggestion_priority")
SELECT id, 'Generic search',
  'https://www.trueup.io/jobs?keywords={KEYWORDS}',
  'Aggregator focused on funded startups/scale-ups. Tech-leaning audience.', 1
FROM "job_platforms" WHERE "key" = 'trueup-mnrnnhqd'
AND NOT EXISTS (
  SELECT 1 FROM "job_platform_search_presets" p
  WHERE p.platform_id = "job_platforms".id AND p.label = 'Generic search'
);
