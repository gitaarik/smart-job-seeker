-- The server stops holding platform passwords (2026-11-14, sjs-ops
-- planning/PLATFORM-PASSWORDS-REMOVED.md). The user signs in to a job site in
-- the browser on their own device, which keeps the session; the username stays
-- so a site that signs in with an emailed code can still be signed in to by a
-- run. api_token and provider_profile_id were unused leftovers of the hosted
-- browser providers removed in 0106.
ALTER TABLE "search_tasks" ALTER COLUMN "login_mode" SET DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "platform_credentials" DROP COLUMN "password";--> statement-breakpoint
ALTER TABLE "platform_credentials" DROP COLUMN "api_token";--> statement-breakpoint
ALTER TABLE "platform_credentials" DROP COLUMN "provider_profile_id";--> statement-breakpoint
ALTER TABLE "platform_credentials" DROP COLUMN "security_answer";--> statement-breakpoint
-- "auto" typed the stored password; with none to type it is the same as
-- signing in, which is what those tasks become.
UPDATE "search_tasks" SET "login_mode" = 'manual' WHERE "login_mode" = 'auto';
