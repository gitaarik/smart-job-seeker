ALTER TABLE "profiles" ADD COLUMN "email_digest_preferred_hour" integer DEFAULT 9;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "email_digest_send_to" varchar(20) DEFAULT 'profile';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" varchar(100);