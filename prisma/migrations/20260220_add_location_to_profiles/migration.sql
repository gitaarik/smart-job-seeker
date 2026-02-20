-- Add single location field to profiles
ALTER TABLE "profiles" ADD COLUMN "location" VARCHAR(255);

-- Migrate existing data: combine city, region, country_code into location
UPDATE "profiles"
SET "location" = CONCAT_WS(', ',
  NULLIF(COALESCE("city", "location_city"), ''),
  NULLIF(COALESCE("region", "location_region"), ''),
  NULLIF(COALESCE("country_code", "location_country_code"), '')
)
WHERE "city" IS NOT NULL
   OR "region" IS NOT NULL
   OR "country_code" IS NOT NULL
   OR "location_city" IS NOT NULL
   OR "location_region" IS NOT NULL
   OR "location_country_code" IS NOT NULL;
