-- User-wide credentials and devices
--
-- Splits credential storage from per-profile runtime state, moves device
-- (api_key) ownership from profile to user, and cleans up legacy columns
-- left over from earlier refactors (observed_filters, suggestion_priority,
-- job_platform_search_presets).
--
-- Ordering: additive schema → data backfills → constraint tightening →
-- legacy drops. Drizzle runs migrations inside a transaction, so a partial
-- failure rolls back cleanly.

-- ── Phase 1a: new table ──────────────────────────────────────────────────

CREATE TABLE "platform_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform_id" integer NOT NULL,
	"username" varchar(255),
	"password" text,
	"api_token" text,
	"provider_profile_id" varchar(255),
	"security_answer" text,
	"date_created" timestamp with time zone DEFAULT now(),
	"date_updated" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "platform_credentials" ADD CONSTRAINT "platform_credentials_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_credentials" ADD CONSTRAINT "platform_credentials_platform_fkey" FOREIGN KEY ("platform_id") REFERENCES "public"."job_platforms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_credentials_user_platform_username_unique" ON "platform_credentials" USING btree ("user_id","platform_id","username");--> statement-breakpoint

-- ── Phase 1b: nullable new columns (NOT-NULLed after backfill) ───────────

ALTER TABLE "platform_profiles" ADD COLUMN "platform_credential_id" integer;--> statement-breakpoint
ALTER TABLE "platform_profiles" ADD CONSTRAINT "platform_profiles_credential_fkey" FOREIGN KEY ("platform_credential_id") REFERENCES "public"."platform_credentials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_shares" ADD COLUMN "platform_credential_id" integer;--> statement-breakpoint
ALTER TABLE "credential_shares" ADD CONSTRAINT "credential_shares_platform_credential_id_fkey" FOREIGN KEY ("platform_credential_id") REFERENCES "public"."platform_credentials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_form_probe_runs" ADD COLUMN "platform_credential_id" integer;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "job_platforms" ADD COLUMN "search_page_url" varchar(512);--> statement-breakpoint
ALTER TABLE "job_platforms" ADD COLUMN "unsupported_filters" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "job_platforms" ADD COLUMN "unsupported_filters_at" timestamp with time zone;--> statement-breakpoint

-- ── Phase 2: data backfills ──────────────────────────────────────────────

-- One platform_credentials row per unique (user_id, platform_id, username).
-- Duplicate-by-triple rows (same login on multiple profiles) collapse into
-- one credential that all profiles end up pointing at.
INSERT INTO "platform_credentials"
	("user_id", "platform_id", "username", "password", "api_token", "provider_profile_id", "security_answer", "date_created", "date_updated")
SELECT DISTINCT ON (p.user_id, pp.platform_id, pp.username)
	p.user_id, pp.platform_id, pp.username, pp.password, pp.api_token, pp.provider_profile_id, pp.security_answer,
	COALESCE(pp.date_created, now()), COALESCE(pp.date_updated, now())
FROM "platform_profiles" pp
JOIN "profiles" p ON p.id = pp.profile_id
WHERE pp.platform_id IS NOT NULL
ORDER BY p.user_id, pp.platform_id, pp.username, pp.id ASC
ON CONFLICT ("user_id", "platform_id", "username") DO NOTHING;
--> statement-breakpoint

-- Link each platform_profiles row to its credential. NULL-safe username
-- match: legacy rows with NULL username link to the credential row with
-- NULL username for the same (user, platform).
UPDATE "platform_profiles" pp
SET "platform_credential_id" = pc.id
FROM "profiles" p, "platform_credentials" pc
WHERE p.id = pp.profile_id
	AND pc.user_id = p.user_id
	AND pc.platform_id = pp.platform_id
	AND pc.username IS NOT DISTINCT FROM pp.username;
--> statement-breakpoint

-- Repoint credential_shares from platform_profile_id to platform_credential_id.
UPDATE "credential_shares" cs
SET "platform_credential_id" = pp."platform_credential_id"
FROM "platform_profiles" pp
WHERE pp.id = cs."platform_profile_id"
	AND pp."platform_credential_id" IS NOT NULL;
--> statement-breakpoint

-- Repoint search_form_probe_runs likewise.
UPDATE "search_form_probe_runs" sfpr
SET "platform_credential_id" = pp."platform_credential_id"
FROM "platform_profiles" pp
WHERE pp.id = sfpr."platform_profile_id"
	AND pp."platform_credential_id" IS NOT NULL;
--> statement-breakpoint

-- api_keys.user_id from the owning profile.
UPDATE "api_keys" ak
SET "user_id" = p.user_id
FROM "profiles" p
WHERE p.id = ak."profile_id";
--> statement-breakpoint

-- ── Phase 3: tighten constraints (guards refuse to proceed on orphans) ───

DO $$
DECLARE orphan_count int;
BEGIN
	SELECT count(*) INTO orphan_count FROM "api_keys" WHERE "user_id" IS NULL;
	IF orphan_count > 0 THEN
		RAISE EXCEPTION 'api_keys: % rows still NULL user_id after backfill', orphan_count;
	END IF;
END $$;
--> statement-breakpoint

DO $$
DECLARE orphan_count int;
BEGIN
	SELECT count(*) INTO orphan_count FROM "credential_shares" WHERE "platform_credential_id" IS NULL;
	IF orphan_count > 0 THEN
		RAISE EXCEPTION 'credential_shares: % rows still NULL platform_credential_id after backfill', orphan_count;
	END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "api_keys" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "credential_shares" ALTER COLUMN "platform_credential_id" SET NOT NULL;--> statement-breakpoint

-- ── Phase 4: drop legacy FKs/indexes/columns/tables ──────────────────────

ALTER TABLE "api_keys" DROP CONSTRAINT IF EXISTS "api_keys_profile_foreign";--> statement-breakpoint
ALTER TABLE "credential_shares" DROP CONSTRAINT IF EXISTS "credential_shares_platform_profile_id_fkey";--> statement-breakpoint
ALTER TABLE "search_tasks" DROP CONSTRAINT IF EXISTS "search_tasks_preset_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_api_keys_profile";--> statement-breakpoint
DROP INDEX IF EXISTS "credential_shares_pp_user_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_credential_shares_pp";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_search_tasks_preset_id";--> statement-breakpoint

ALTER TABLE "api_keys" DROP COLUMN "profile_id";--> statement-breakpoint
ALTER TABLE "credential_shares" DROP COLUMN "platform_profile_id";--> statement-breakpoint
ALTER TABLE "search_form_probe_runs" DROP COLUMN "platform_profile_id";--> statement-breakpoint
ALTER TABLE "platform_profiles" DROP COLUMN "username";--> statement-breakpoint
ALTER TABLE "platform_profiles" DROP COLUMN "password";--> statement-breakpoint
ALTER TABLE "platform_profiles" DROP COLUMN "api_token";--> statement-breakpoint
ALTER TABLE "platform_profiles" DROP COLUMN "provider_profile_id";--> statement-breakpoint
ALTER TABLE "platform_profiles" DROP COLUMN "security_answer";--> statement-breakpoint
ALTER TABLE "job_platforms" DROP COLUMN "search_url_template";--> statement-breakpoint
ALTER TABLE "job_platforms" DROP COLUMN "suggestion_priority";--> statement-breakpoint
ALTER TABLE "job_platforms" DROP COLUMN "suggestion_hint";--> statement-breakpoint
ALTER TABLE "search_tasks" DROP COLUMN "preset_id";--> statement-breakpoint

-- search-form-probe presets were rolled into job_platforms; the table is unused.
ALTER TABLE IF EXISTS "job_platform_search_presets" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "job_platform_search_presets" CASCADE;--> statement-breakpoint

-- ── Phase 5: final-state indexes ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "idx_api_keys_user" ON "api_keys" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credential_shares_credential_user_unique" ON "credential_shares" USING btree ("platform_credential_id" int4_ops,"shared_with" text_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_credential_shares_credential" ON "credential_shares" USING btree ("platform_credential_id" int4_ops);
