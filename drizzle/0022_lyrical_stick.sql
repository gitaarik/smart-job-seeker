ALTER TABLE "applications" ADD COLUMN "snoozed_until" date;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "snooze_reason" varchar(255);