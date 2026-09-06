-- Entity images before `uploads/` were `files` rows addressed by uuid and served
-- from /assets/<uuid>. saveEntityMedia has been writing a `*_path` and nulling the
-- uuid for a while, so these three columns only still held rows that also had a
-- path, and the fallback they existed for could not fire. Measured 0 rows needing
-- it on dev and preview; production has no data.
--
-- If some environment disagrees, that is an image about to disappear with no way
-- to get it back (the legacy blobs are already gone from disk), so stop instead.
DO $$
DECLARE stranded int;
BEGIN
	SELECT (SELECT count(*) FROM work_experiences WHERE logo_path IS NULL AND logo_id IS NOT NULL)
	     + (SELECT count(*) FROM education WHERE logo_path IS NULL AND logo_id IS NOT NULL)
	     + (SELECT count(*) FROM profiles WHERE profile_photo_path IS NULL AND profile_picture_id IS NOT NULL)
	  INTO stranded;
	IF stranded > 0 THEN
		RAISE EXCEPTION 'refusing to drop the legacy image columns: % row(s) still render from them', stranded;
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "education" DROP CONSTRAINT "education_logo_foreign";
--> statement-breakpoint
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_profile_picture_foreign";
--> statement-breakpoint
ALTER TABLE "work_experiences" DROP CONSTRAINT "work_experiences_logo_foreign";
--> statement-breakpoint
DROP INDEX "education_logo_idx";--> statement-breakpoint
DROP INDEX "profiles_profile_picture_idx";--> statement-breakpoint
DROP INDEX "work_experiences_logo_idx";--> statement-breakpoint
ALTER TABLE "education" DROP COLUMN "logo_id";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "profile_picture_id";--> statement-breakpoint
ALTER TABLE "work_experiences" DROP COLUMN "logo_id";