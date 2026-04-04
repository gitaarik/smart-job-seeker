-- Add salary settings to profiles (simplified salary model)
ALTER TABLE "profiles" ADD COLUMN "salary_base_rate" INTEGER;
ALTER TABLE "profiles" ADD COLUMN "salary_currency" VARCHAR(10) DEFAULT 'EUR';
ALTER TABLE "profiles" ADD COLUMN "salary_adjustments" JSON;
ALTER TABLE "profiles" ADD COLUMN "salary_region_overrides" JSON;
