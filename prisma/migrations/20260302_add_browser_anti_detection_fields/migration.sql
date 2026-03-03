-- Add browser_country_code to profiles
-- Determines the browser's apparent location (proxy geo, timezone, locale).
-- Separate from location_country_code which is for resume/CV data.
-- NULL means fall back to location_country_code.
ALTER TABLE "profiles" ADD COLUMN "browser_country_code" VARCHAR(10);

-- Add provider_profile_id to platform_profiles
-- Stores the cloud browser provider's profile ID (e.g., GoLogin profile ID)
-- so the same browser identity (fingerprint, cookies) persists across sessions.
-- Managed automatically by the system, never user-configured.
ALTER TABLE "platform_profiles" ADD COLUMN "provider_profile_id" VARCHAR(255);
