-- The hourly base rate, its currency, its region rates and the income
-- assumptions, all carried into salary_employed and salary_freelance by 0070.
-- See that file for how each one moved.
ALTER TABLE "profiles" DROP COLUMN "salary_base_rate";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "salary_currency";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "salary_region_overrides";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "salary_income_assumptions";