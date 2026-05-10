-- Extend the suggest pool with vetted platforms.
--
-- Earlier curation excluded vetted marketplaces from the pool on the
-- (incorrect) assumption that login-gated meant unsupported — the scraper
-- handles auto-login when credentials are stored, so vetted platforms are
-- in scope as long as we have an accurate URL template.
--
-- This migration adds the publicly-browsable vetted platforms where I'm
-- confident about the URL template. Login-gated ones (Toptal dashboard,
-- Turing dashboard, Mercor work portal, etc.) are deferred — their URL
-- patterns are inside the authenticated app and need a real account to
-- verify. Adding them blindly would be exactly the "hallucinated URL"
-- failure mode the system was designed to avoid.
--
-- All UPDATEs are guarded with search_url_template IS NULL so re-runs
-- against curated prod data don't clobber.

-- Arc.dev — remote-tech, vetted but broad applicant pool, public listings.
UPDATE "job_platforms"
SET "search_url_template" = 'https://arc.dev/remote-jobs?search={KEYWORDS}',
    "suggestion_priority" = 11,
    "suggestion_hint" = 'Vetted remote tech roles with broad applicant pool. Curated jobs, less spam than open boards.'
WHERE "key" = 'arc-dev' AND "search_url_template" IS NULL;
--> statement-breakpoint

-- X-Team — remote dev / contract roles. Listings page is public; URL has no
-- keyword search so the LLM uses the bare URL (no placeholder substitution).
UPDATE "job_platforms"
SET "search_url_template" = 'https://x-team.com/jobs/',
    "suggestion_priority" = 12,
    "suggestion_hint" = 'Remote dev roles via X-Team agency. Pick for engineers open to contract/agency placement. URL has no keyword search — surfaces the full listings page.'
WHERE "key" = 'x-team' AND "search_url_template" IS NULL;
--> statement-breakpoint

-- trueup.io — startup/scaleup aggregator with public keyword search.
UPDATE "job_platforms"
SET "search_url_template" = 'https://www.trueup.io/jobs?keywords={KEYWORDS}',
    "suggestion_priority" = 13,
    "suggestion_hint" = 'Aggregator focused on funded startups/scaleups. Pick for tech profiles interested in venture-backed companies.'
WHERE "key" = 'trueup-mnrnnhqd' AND "search_url_template" IS NULL;
