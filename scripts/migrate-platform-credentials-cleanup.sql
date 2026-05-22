-- Follow-up to migrate-platform-credentials.sql.
--
-- Drops the legacy credential columns from platform_profiles (now lives in
-- platform_credentials) plus the legacy platform_profile_id column on
-- credential_shares (replaced by platform_credential_id).
--
-- Run this AFTER:
--   1. migrate-platform-credentials.sql has been applied
--   2. The user-wide-credentials code has been deployed and verified
--      working — the new code never reads or writes these columns, but
--      this drop is irreversible without backup, so don't rush it.

BEGIN;

ALTER TABLE platform_profiles
  DROP COLUMN IF EXISTS username,
  DROP COLUMN IF EXISTS password,
  DROP COLUMN IF EXISTS api_token,
  DROP COLUMN IF EXISTS provider_profile_id,
  DROP COLUMN IF EXISTS security_answer;

ALTER TABLE credential_shares
  ALTER COLUMN platform_credential_id SET NOT NULL,
  DROP COLUMN IF EXISTS platform_profile_id;

ALTER TABLE search_form_probe_runs
  DROP COLUMN IF EXISTS platform_profile_id;

-- Legacy indexes from when credential_shares keyed on platform_profile_id.
DROP INDEX IF EXISTS credential_shares_pp_user_unique;
DROP INDEX IF EXISTS idx_credential_shares_pp;

COMMIT;
