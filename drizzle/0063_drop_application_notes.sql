-- Move each note from the list on the application to its timeline, then drop
-- the list.
--
-- `application_notes` was a jsonb list that only the overview page read. A note
-- is a `note` entry on the timeline now, where the key facts, the assistant and
-- the letters read it as the applicant's own words, so every note with text is
-- copied there first, dated when it was written. The title is its first line,
-- as `deriveRecordTitle` writes one.
--
-- The app wrote `created_at` with `toISOString()`, older rows hold Postgres's
-- own text form (a space for the T), and an imported export carried the list
-- verbatim, so the timestamp is checked before it is cast: one that is missing
-- or in neither form dates the note now, rather than failing the migration or
-- leaving the note behind.
INSERT INTO "application_records"
	("application_id", "record_type", "title", "content", "event_date", "extraction_status", "date_created")
SELECT
	n."application_id",
	'note',
	CASE
		WHEN char_length(n."first_line") > 120 THEN rtrim(left(n."first_line", 120)) || '…'
		ELSE n."first_line"
	END,
	n."content",
	n."written"::date,
	'none',
	n."written"
FROM (
	SELECT
		a."id" AS "application_id",
		item."ord",
		btrim(item."note" ->> 'text', E' \t\r\n') AS "content",
		btrim(split_part(btrim(item."note" ->> 'text', E' \t\r\n'), E'\n', 1), E' \t\r') AS "first_line",
		CASE
			WHEN (item."note" ->> 'created_at')
				~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])[T ]([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)$'
				THEN (item."note" ->> 'created_at')::timestamptz
			ELSE now()
		END AS "written"
	FROM "applications" a
	CROSS JOIN LATERAL jsonb_array_elements(
		CASE WHEN jsonb_typeof(a."application_notes") = 'array' THEN a."application_notes" ELSE '[]'::jsonb END
	) WITH ORDINALITY AS item("note", "ord")
	WHERE jsonb_typeof(item."note") = 'object'
		AND jsonb_typeof(item."note" -> 'text') = 'string'
) AS n
WHERE n."content" <> ''
ORDER BY n."application_id", n."ord";--> statement-breakpoint
ALTER TABLE "applications" DROP COLUMN "application_notes";
