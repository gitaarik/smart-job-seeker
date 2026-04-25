ALTER TABLE "platform_profiles" ALTER COLUMN "password" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "platform_profiles" ALTER COLUMN "security_answer" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "time_format" varchar(10);