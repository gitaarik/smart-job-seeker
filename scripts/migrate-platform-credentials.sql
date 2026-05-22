-- Migrate to user-wide platform credentials.
--
-- Splits platform_profiles' credential columns into a new
-- platform_credentials table keyed by (user_id, platform_id, username) so
-- the same login is reused across all of a user's profiles. Repoints
-- credential_shares from platform_profile_id to platform_credential_id.
--
-- Idempotent guards: every CREATE/ADD uses IF NOT EXISTS, and the backfill
-- INSERT uses ON CONFLICT DO NOTHING so repeated runs are safe.
--
-- This script does NOT drop the legacy credential columns from
-- platform_profiles or the legacy platform_profile_id from
-- credential_shares. That happens in a follow-up migration after code is
-- updated and verified.

BEGIN;

-- 1. New table -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS platform_credentials (
  id serial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform_id integer NOT NULL REFERENCES job_platforms(id) ON DELETE CASCADE,
  username varchar(255),
  password text,
  api_token text,
  provider_profile_id varchar(255),
  security_answer text,
  date_created timestamp with time zone DEFAULT now(),
  date_updated timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_credentials_user_platform_username_unique
  ON platform_credentials (user_id, platform_id, username);

-- 2. New FK columns --------------------------------------------------------

ALTER TABLE platform_profiles
  ADD COLUMN IF NOT EXISTS platform_credential_id integer
    REFERENCES platform_credentials(id) ON DELETE SET NULL;

ALTER TABLE credential_shares
  ADD COLUMN IF NOT EXISTS platform_credential_id integer
    REFERENCES platform_credentials(id) ON DELETE CASCADE;

-- 3. Backfill platform_credentials from platform_profiles ------------------
--
-- One credential row per unique (user_id, platform_id, username). Multiple
-- platform_profiles rows with the same triple collapse into one credential
-- (that's the whole point — same LinkedIn login on N profiles becomes one
-- row that all N profiles point to). ON CONFLICT DO NOTHING handles the
-- collapse; the canonical row is whichever inserts first (oldest in id
-- order via the ORDER BY).

INSERT INTO platform_credentials
  (user_id, platform_id, username, password, api_token, provider_profile_id, security_answer, date_created, date_updated)
SELECT DISTINCT ON (p.user_id, pp.platform_id, pp.username)
  p.user_id,
  pp.platform_id,
  pp.username,
  pp.password,
  pp.api_token,
  pp.provider_profile_id,
  pp.security_answer,
  COALESCE(pp.date_created, now()),
  COALESCE(pp.date_updated, now())
FROM platform_profiles pp
JOIN profiles p ON p.id = pp.profile_id
WHERE pp.platform_id IS NOT NULL
ORDER BY p.user_id, pp.platform_id, pp.username, pp.id ASC
ON CONFLICT (user_id, platform_id, username) DO NOTHING;

-- 4. Link platform_profiles → platform_credentials -------------------------
--
-- NULL-safe username match: legacy rows with NULL username link to the
-- credential row with NULL username for the same (user_id, platform_id).

UPDATE platform_profiles pp
SET platform_credential_id = pc.id
FROM profiles p, platform_credentials pc
WHERE p.id = pp.profile_id
  AND pc.user_id = p.user_id
  AND pc.platform_id = pp.platform_id
  AND pc.username IS NOT DISTINCT FROM pp.username
  AND pp.platform_credential_id IS NULL;

-- 5. Repoint credential_shares.platform_credential_id ----------------------

UPDATE credential_shares cs
SET platform_credential_id = pp.platform_credential_id
FROM platform_profiles pp
WHERE pp.id = cs.platform_profile_id
  AND cs.platform_credential_id IS NULL
  AND pp.platform_credential_id IS NOT NULL;

-- Old shares pointing at a platform_profiles row whose credential failed
-- to backfill (e.g. orphaned) become unusable; surface them rather than
-- silently dropping. Should be zero on a healthy DB.
DO $$
DECLARE
  orphan_count int;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM credential_shares
  WHERE platform_credential_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE NOTICE 'credential_shares: % rows have no platform_credential_id after backfill (orphaned platform_profile_id?)', orphan_count;
  END IF;
END $$;

-- 6. New unique + lookup indexes on credential_shares ----------------------

CREATE UNIQUE INDEX IF NOT EXISTS credential_shares_credential_user_unique
  ON credential_shares (platform_credential_id, shared_with);
CREATE INDEX IF NOT EXISTS idx_credential_shares_credential
  ON credential_shares (platform_credential_id);

-- (legacy indexes credential_shares_pp_user_unique / idx_credential_shares_pp
--  stay for now — dropped in the follow-up migration once code is repointed.)

COMMIT;
