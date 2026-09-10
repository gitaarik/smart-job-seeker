-- Make `about_me_text` plain text, like every other prose field on the profile.
--
-- The column predates this app: Directus wrote it from a rich-text editor that
-- fed the portfolio site, so the rows hold `<p>…</p><p class="my-4">…</p>`
-- rather than paragraphs. Nothing has read the column since — no UI, no
-- renderer, no export consumer that cares about the markup — so the HTML has
-- been invisible rather than wrong.
--
-- It stops being invisible now: the field gets a textarea on the profile
-- editor and a copy button whose entire purpose is pasting the text into
-- LinkedIn or a personal site. Both want the same thing `summary` already is,
-- and neither wants `<p class="my-4">` in the middle of it.
--
-- Converting the data rather than teaching the editor to render HTML, because
-- the contract this field wants is the one the rest of the profile has. A
-- rich-text column would have to survive translations, field variants and the
-- assistant's `${data}` blob, and every one of those treats profile prose as
-- text.
--
-- The guard names actual markup tags rather than a bare `<`, so a bio someone
-- writes later that happens to contain `a < b` is not "converted", and re-running
-- this against already-converted rows is a no-op.
--
-- `\y` for the word boundary, not `\b`: in Postgres' regex flavour `\b` is a
-- backspace character, so the guard matched nothing at all and the whole
-- migration reported "UPDATE 0" while looking correct.
-- Read in a CTE and written back by id, rather than as one nested expression
-- in SET: an UPDATE target cannot be referenced from a LATERAL in its own FROM
-- clause, and four named steps say what the conversion does in a way six
-- nested regexp_replace calls do not.
WITH converted AS (
	SELECT p."id", collapsed.t
	FROM "profiles" p,
		LATERAL (
			-- A paragraph boundary is the only place the markup carried meaning.
			SELECT regexp_replace(p."about_me_text", '</p>\s*<p[^>]*>', E'\n\n', 'gi') AS t
		) AS paragraphs,
		LATERAL (
			SELECT regexp_replace(
				regexp_replace(paragraphs.t, '<br\s*/?>', E'\n', 'gi'),
				'<[^>]+>', '', 'g'
			) AS t
		) AS stripped,
		LATERAL (
			-- `&amp;` last: decoding it first would turn a literal `&amp;lt;` into `<`.
			SELECT replace(replace(replace(replace(replace(replace(
				stripped.t,
				'&nbsp;', ' '),
				'&lt;', '<'),
				'&gt;', '>'),
				'&quot;', '"'),
				'&#39;', ''''),
				'&amp;', '&'
			) AS t
		) AS entities,
		LATERAL (
			SELECT btrim(regexp_replace(entities.t, E'\n{3,}', E'\n\n', 'g')) AS t
		) AS collapsed
	WHERE p."about_me_text" ~* '</?(p|br|div|span|strong|em|ul|ol|li)\y'
)
UPDATE "profiles" p
SET "about_me_text" = c.t
FROM converted c
WHERE p."id" = c."id";
