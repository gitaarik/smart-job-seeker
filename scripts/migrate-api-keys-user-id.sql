-- Migrate api_keys from per-profile to per-user.
--
-- A device (api_key) is a physical machine; tying it to a specific profile
-- forced duplicate registrations and caused the desktop tunnel to look
-- offline on profiles other than the one it registered against. Moving to
-- user_id makes one registration visible across all of the user's
-- profiles.
--
-- Idempotent guards: every CREATE/ADD uses IF NOT EXISTS, every backfill
-- predicates on user_id IS NULL so re-runs are safe. The legacy
-- profile_id column stays through this migration; a follow-up drops it
-- after code is deployed and verified.

BEGIN;

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS user_id text
    REFERENCES users(id) ON DELETE CASCADE;

UPDATE api_keys ak
SET user_id = p.user_id
FROM profiles p
WHERE p.id = ak.profile_id
  AND ak.user_id IS NULL;

DO $$
DECLARE
  orphan_count int;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM api_keys
  WHERE user_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'api_keys: % rows still NULL user_id after backfill — refusing to set NOT NULL', orphan_count;
  END IF;
END $$;

ALTER TABLE api_keys ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_user
  ON api_keys (user_id);

COMMIT;
