-- Activity cutover. Hand-edited: generated migrations don't move data, and
-- both DROPs below are irreversible, so the INSERT…SELECTs must run first and
-- in the same transaction. See planning/APPLICATION-ACTIVITY.md.
--
-- Deliberately NOT split across two migrations: while `applications_files` is
-- still a write target an early copy diverges from every upload made after it,
-- so the move and the drop belong together.

-- 1. Attached files become Activity entries.
--
-- `message` rather than `note`, because `note` now means "an update the
-- applicant wrote themselves" and a file someone attached is far likelier
-- received than written. Typing every migrated document as authored would make
-- every pre-existing application report "no employer contact yet" until the
-- derivation pass re-types them.
--
-- `derived_at` stays NULL, which is what keeps that aggregate honest: it reads
-- `contacts` being empty, and NULL here means "nobody has looked", not
-- "nobody was involved".
INSERT INTO "application_records"
  ("application_id", "record_type", "title", "content", "event_date",
   "file_id", "extraction_status", "extraction_error", "date_extracted",
   "date_created")
SELECT
  af."applications_id",
  'message',
  COALESCE(NULLIF(TRIM(f."title"), ''), f."filename_download", 'Untitled'),
  af."extracted_text",
  -- applications_files has no date_created; extraction time is the closest
  -- thing to "when this arrived", and these rows had no event date before.
  COALESCE(af."date_extracted"::date, CURRENT_DATE),
  af."file_id",
  CASE af."extraction_status"
    WHEN 'extracted' THEN 'extracted'
    WHEN 'skipped'   THEN 'skipped'
    ELSE 'pending'
  END,
  af."extraction_error",
  af."date_extracted",
  COALESCE(af."date_extracted", CURRENT_TIMESTAMP)
FROM "applications_files" af
LEFT JOIN "files" f ON f."id" = af."file_id"
WHERE af."applications_id" IS NOT NULL;--> statement-breakpoint

-- 2. Manual timeline events become notes.
--
-- The Timeline tab's "Add Event" wrote a status-log row with from_status =
-- to_status and a free-text description — a note pinned to the current stage,
-- which is exactly `record_type: 'note'` with `step` from the application's
-- status. Real transitions (from_status <> to_status) are untouched and still
-- render in the Activity stream as status markers.
--
-- Dev had 0 of these against 26 real transitions; preview and prod may differ.
INSERT INTO "application_records"
  ("application_id", "record_type", "title", "content", "event_date", "step",
   "extraction_status", "date_created")
SELECT
  sl."application",
  'note',
  -- Same first-line rule the composer uses, so migrated notes are titled the
  -- way newly written ones are.
  LEFT(SPLIT_PART(TRIM(sl."description"), E'\n', 1), 120),
  sl."description",
  COALESCE(sl."action_date", sl."date_created"::date, CURRENT_DATE),
  sl."step",
  'none',
  COALESCE(sl."date_created", CURRENT_TIMESTAMP)
FROM "application_status_log" sl
WHERE sl."from_status" IS NOT DISTINCT FROM sl."to_status"
  AND NULLIF(TRIM(sl."description"), '') IS NOT NULL;--> statement-breakpoint

DELETE FROM "application_status_log"
WHERE "from_status" IS NOT DISTINCT FROM "to_status"
  AND NULLIF(TRIM("description"), '') IS NOT NULL;--> statement-breakpoint

-- 3. Both tables go. application_activity_log was loaded by the application
-- layout and rendered by nothing at all.
DROP TABLE "application_activity_log" CASCADE;--> statement-breakpoint
DROP TABLE "applications_files" CASCADE;
