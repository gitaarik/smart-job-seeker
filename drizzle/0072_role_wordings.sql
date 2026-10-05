-- Let a role's position have alternative wordings, and move the per-template
-- positions into them.
--
-- `profile_template_overrides` held one forced value per presentation template
-- for a role's position ("on Citrus this role is Senior Engineer"). A template
-- is how a document looks, and what a title should say turned out to depend on
-- the job: every document sent in the one template that used this had a version
-- of its own, and all of them shared the one value, so setting it for today's
-- job rewrote the title on every earlier document in that template.
--
-- `profile_field_variants` already answers the same question the right way
-- round for the profile's own fields: a list of alternatives per field, and a
-- version picks one. This gives a variant a role to belong to and copies each
-- override into the list of the role it was written for.
--
-- This migration only adds. The old table keeps its rows and nothing reads it
-- from here on; removing it is a separate decision and a separate migration.

-- 1. A variant can belong to a role. Null stays "a field of the profile", so no
--    existing row needs a value. A real foreign key, so a role's wordings go
--    with the role on every path that removes one.
ALTER TABLE "profile_field_variants" ADD COLUMN "work_experience_id" integer;--> statement-breakpoint
ALTER TABLE "profile_field_variants" ADD CONSTRAINT "profile_field_variants_work_experience_foreign" FOREIGN KEY ("work_experience_id") REFERENCES "public"."work_experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_field_variants_work_experience_idx" ON "profile_field_variants" USING btree ("work_experience_id");--> statement-breakpoint

-- 2. The copy, as one statement, because its three inserts have to agree on
--    which new wording stands for which override. `moves` draws each wording's
--    id up front and is read by all three; a CTE that calls nextval is computed
--    once, so they see the same ids. An INSERT cannot return the template its
--    row came from, and matching the new rows back by label would guess between
--    two templates of one name.
--
--    One wording per (template, role) that had an override. Its value is the
--    override written in the base language. One written only in another
--    language starts from the role's own position, and its translation carries
--    what it said.
--
--    The joins in `moves` are the ownership check the endpoint made on the way
--    in. An override whose role is gone, or belongs to another profile than its
--    template, has nothing to move to and is not copied.
WITH "moves" AS (
	SELECT
		nextval(pg_get_serial_sequence('profile_field_variants', 'id')) AS "variant_id",
		g."template_id",
		g."work_experience_id",
		w."profile_id",
		t."name" AS "template_name",
		t."slug" AS "template_slug",
		COALESCE(g."base_value", w."position") AS "value",
		(row_number() OVER (PARTITION BY g."work_experience_id" ORDER BY g."template_id") - 1)::integer AS "sort"
	FROM (
		SELECT
			o."template_id",
			o."entity_id" AS "work_experience_id",
			max(o."value") FILTER (WHERE o."locale" = 'en') AS "base_value"
		FROM "profile_template_overrides" o
		WHERE o."entity_type" = 'work_experience' AND o."field" = 'position'
		GROUP BY o."template_id", o."entity_id"
	) g
	JOIN "presentation_templates" t ON t."id" = g."template_id"
	JOIN "work_experiences" w ON w."id" = g."work_experience_id" AND w."profile_id" = t."profile_id"
),
-- Named after the template, which is what the applicant knew it by. No note:
-- "when to use it" is theirs to write, and a template's name says nothing a
-- job description could be matched against.
"wordings" AS (
	INSERT INTO "profile_field_variants"
		("id", "profile_id", "work_experience_id", "field", "label", "value", "note", "sort", "date_created", "date_updated")
	SELECT
		m."variant_id", m."profile_id", m."work_experience_id", 'position', m."template_name", m."value", NULL, m."sort", now(), now()
	FROM "moves" m
	RETURNING "id"
),
-- What an override said in another language becomes the wording's own
-- translation, keyed on the variant like every other one.
"translations" AS (
	INSERT INTO "profile_translations"
		("profile_id", "entity_type", "entity_id", "field", "locale", "value", "date_created", "date_updated")
	SELECT
		m."profile_id", 'profile_field_variant', m."variant_id", 'value', o."locale", o."value", now(), now()
	FROM "profile_template_overrides" o
	JOIN "moves" m ON m."template_id" = o."template_id" AND m."work_experience_id" = o."entity_id"
	WHERE o."entity_type" = 'work_experience' AND o."field" = 'position' AND o."locale" <> 'en'
	RETURNING "id"
)
-- Keep each wording on the documents that printed it. An override applied to
-- whatever was rendered in its template; a pick belongs to a version. So an
-- application recorded as sent in that template, with a version of its own,
-- gets the pick on that version, as the applicant's own decision, which a
-- regeneration leaves alone. A library version sent in the template gets none:
-- the same version prints in other templates too, and a pick there would
-- change those.
INSERT INTO "profile_version_overrides"
	("version_id", "entity_type", "entity_id", "action", "reason", "source", "date_created", "date_updated")
SELECT
	v."id", 'profile_field_variant', m."variant_id", 'include',
	'your position on the ' || m."template_name" || ' template, kept on this document',
	'user', now(), now()
FROM "moves" m
JOIN "applications" a
	ON a."profile_id" = m."profile_id" AND a."cv_template_sent" = m."template_slug"
JOIN "profile_versions" v
	ON v."application_id" = a."id" AND v."profile_id" = m."profile_id" AND v."slug" = a."cv_version_sent";
