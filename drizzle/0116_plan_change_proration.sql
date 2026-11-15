ALTER TABLE "credit_balances" ADD COLUMN "allowance_plan" varchar(50);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "kept_plan" varchar(50);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "kept_plan_until" timestamp (6) with time zone;