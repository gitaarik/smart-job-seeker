-- Credential sharing between contacts.
-- Mirrors device_shares: a row per (platform_profile, contact) sharing.
-- A contact who has a credential shared with them can use it on import tasks
-- but cannot read the password — credentials are only resolved server-side
-- by the scraper, and only paired with devices owned by the credential owner.
CREATE TABLE "credential_shares" (
        "id" serial PRIMARY KEY NOT NULL,
        "platform_profile_id" integer NOT NULL,
        "shared_with" text NOT NULL,
        "date_created" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "credential_shares_pp_user_unique"
        ON "credential_shares" USING btree ("platform_profile_id" int4_ops, "shared_with" text_ops);
CREATE INDEX "idx_credential_shares_pp"
        ON "credential_shares" USING btree ("platform_profile_id" int4_ops);
CREATE INDEX "idx_credential_shares_shared_with"
        ON "credential_shares" USING btree ("shared_with" text_ops);

ALTER TABLE "credential_shares"
        ADD CONSTRAINT "credential_shares_shared_with_fkey"
        FOREIGN KEY ("shared_with") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "credential_shares"
        ADD CONSTRAINT "credential_shares_platform_profile_id_fkey"
        FOREIGN KEY ("platform_profile_id") REFERENCES "platform_profiles"("id") ON DELETE CASCADE;
