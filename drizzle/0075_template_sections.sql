-- Every existing resume template says, in its config, that it prints no side
-- projects.
--
-- A template's config names the optional parts it prints (`sections`, see
-- DocumentSections in src/lib/resume-templates.ts), and one that does not say
-- now prints side projects. Until 2026-10-11 the generic renderer had no
-- projects section at all, so every template made before then printed none,
-- and was designed that way. This writes that down in each one, so they look
-- exactly as before while new templates get the section.
--
-- Only document templates, and only where `sections` is not there yet, so a
-- template that has chosen keeps its choice. The importer does the same for an
-- archive written before templates could choose (import-templates.ts).
UPDATE "presentation_templates"
SET "config" = jsonb_set(
	coalesce("config", '{}'::jsonb),
	'{sections}',
	'{"technologies": true, "sideProjects": false}'::jsonb
)
WHERE "kind" = 'document'
	AND ("config" IS NULL OR jsonb_typeof("config") = 'object')
	AND jsonb_typeof(coalesce("config", '{}'::jsonb) -> 'sections') IS DISTINCT FROM 'object';
