-- Add application_notes JSONB column
ALTER TABLE "applications" ADD COLUMN "application_notes" jsonb DEFAULT '[]'::jsonb;

-- Migrate existing application_note text into the new JSONB array
UPDATE "applications"
  SET "application_notes" = jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'text', "application_note",
      'created_at', COALESCE("date_updated", NOW())::text
    )
  )
  WHERE "application_note" IS NOT NULL AND "application_note" != '';

-- Drop the old column
ALTER TABLE "applications" DROP COLUMN "application_note";
