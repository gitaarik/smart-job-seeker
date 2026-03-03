-- Add browser fingerprint fields to profiles for GoLogin anti-detection
ALTER TABLE "profiles" ADD COLUMN "browser_user_agent" VARCHAR(500);
ALTER TABLE "profiles" ADD COLUMN "browser_language" VARCHAR(50);
ALTER TABLE "profiles" ADD COLUMN "browser_timezone" VARCHAR(100);
