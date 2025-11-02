-- AlterTable
ALTER TABLE "tech_skills" ADD COLUMN "years_experience" INTEGER;

-- Migrate data from years_experience2 to years_experience
UPDATE "tech_skills"
SET "years_experience" = CASE
  WHEN "years_experience2" ~ '^\d+$' THEN CAST("years_experience2" AS INTEGER)
  ELSE NULL
END
WHERE "years_experience2" IS NOT NULL;
