ALTER TABLE "profile_auto_import" ALTER COLUMN "enabled" SET DEFAULT false;--> statement-breakpoint
-- Turn it off for profiles that already have a row, not just new ones. The
-- column shipped defaulting to true, so an `enabled` row records the default
-- rather than a choice anyone made — the one deliberate act it can hold is
-- turning it OFF, and that is what this preserves. The per-profile toggle on
-- /jobs/import/tasks turns it back on in one click.
UPDATE "profile_auto_import" SET "enabled" = false WHERE "enabled" = true;
