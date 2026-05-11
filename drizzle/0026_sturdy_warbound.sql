ALTER TABLE "platform_discovery_runs" ADD COLUMN "platform_profile_id" integer;--> statement-breakpoint
ALTER TABLE "platform_discovery_runs" ADD COLUMN "sjsbrowser_api_key_id" integer;--> statement-breakpoint
ALTER TABLE "job_platforms" DROP COLUMN "discovery_username";--> statement-breakpoint
ALTER TABLE "job_platforms" DROP COLUMN "discovery_password";