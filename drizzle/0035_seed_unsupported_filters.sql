-- Pre-seed `unsupported_filters` for platforms whose UI simply doesn't expose
-- certain canonical filter axes — saves the scraper from running a full
-- identify+heuristic cycle just to discover what we already know, and (more
-- importantly) blocks the heuristic-fallback from picking the wrong checkbox
-- when the platform's vocabulary collides with ours.
--
-- Concrete case this fixes: Upwork has a "Contract" checkbox in its filter
-- sidebar, but it's the *Contract-to-hire ready* flag — orthogonal to the
-- contract/freelance employment relationship (Upwork is contract by default).
-- The heuristic was matching `employment_type=contract` to that checkbox and
-- emitting `contract_to_hire=true` in the URL, narrowing results to a small
-- subset. Pre-seeding `employment_type: ["contract"]` here makes the scraper
-- silently skip that filter on Upwork (the platform's baseline already covers
-- it).
--
-- Union-merges with existing entries — anything already auto-recorded stays.

UPDATE "job_platforms"
SET
  "unsupported_filters" = COALESCE("unsupported_filters", '{}'::jsonb) || jsonb_build_object(
    'hours_commitment', '["fulltime","parttime"]'::jsonb,
    'employment_type', '["permanent","contract","internship","temporary"]'::jsonb,
    'work_location', '["remote","hybrid","onsite"]'::jsonb,
    'experience_level', '["lead","executive"]'::jsonb
  ),
  "unsupported_filters_at" = NOW()
WHERE "key" = 'upwork';
--> statement-breakpoint

-- WeWorkRemotely: remote-only board. Work-location values other than `remote`
-- can't apply; employment-type filters exist but vary by listing tag rather
-- than a faceted UI we drive — defer until we know they have search-form
-- support.
UPDATE "job_platforms"
SET
  "unsupported_filters" = COALESCE("unsupported_filters", '{}'::jsonb) || jsonb_build_object(
    'work_location', '["hybrid","onsite"]'::jsonb
  ),
  "unsupported_filters_at" = NOW()
WHERE "key" = 'we-work-remotely';
