-- The profile photo and the logos, banners and images of roles, education and
-- side projects lived in these `*_path` columns, as files under uploads/, until
-- the media library (migration 0085). scripts/migrate-media-library.ts turns
-- each into a library item, points the slot's `*_id` at it and clears the path;
-- readers fell back to the path until then. Run on dev 2026-11-08 and preview
-- 2026-11-11 (v0.44.0): 0 paths left on either. Production has no data.
--
-- A path still set here is a picture this would lose with its last reference,
-- so stop instead, and say how to keep it.
DO $$
DECLARE stranded int;
BEGIN
	SELECT (SELECT count(*) FROM profiles WHERE profile_photo_path IS NOT NULL)
	     + (SELECT count(*) FROM work_experiences WHERE logo_path IS NOT NULL OR banner_path IS NOT NULL)
	     + (SELECT count(*) FROM education WHERE logo_path IS NOT NULL OR banner_path IS NOT NULL)
	     + (SELECT count(*) FROM side_projects WHERE image_path IS NOT NULL OR banner_path IS NOT NULL)
	  INTO stranded;
	IF stranded > 0 THEN
		RAISE EXCEPTION 'refusing to drop the old image path columns: % row(s) still hold one. Move them into the media library first: deploy v0.44.x and run dist-scripts/migrate-media-library.mjs --apply (scripts/migrate-media-library.ts), then this release.', stranded;
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "education" DROP COLUMN "logo_path";--> statement-breakpoint
ALTER TABLE "education" DROP COLUMN "banner_path";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "profile_photo_path";--> statement-breakpoint
ALTER TABLE "side_projects" DROP COLUMN "image_path";--> statement-breakpoint
ALTER TABLE "side_projects" DROP COLUMN "banner_path";--> statement-breakpoint
ALTER TABLE "work_experiences" DROP COLUMN "logo_path";--> statement-breakpoint
ALTER TABLE "work_experiences" DROP COLUMN "banner_path";