-- Salary Prep prices employment and freelancing separately.
--
-- Both used to come from one hourly `salary_base_rate`: the page showed it as a
-- monthly salary (base x 174 hours) and priced freelancing as the base plus an
-- `employment_type.contract` percentage in `salary_adjustments`. One hourly
-- number cannot be a salary and an invoice at once, so each now has its own ask
-- in the unit it is quoted in (lib/salary/settings.ts):
--
--   salary_employed   the base as a monthly salary, base x 174
--   salary_freelance  the base plus the contract premium, per hour
--
-- Region rates split the same way and keep their currency. Of the income
-- assumptions, the billable hours and both tax rates carry over. The old
-- freelance figure was tax, contributions and costs in one percentage, so it
-- becomes the freelance tax rate with costs at 0. (Take-home still moves a
-- little: the new freelance pension, 10% by default, now comes off before tax.)
-- The contract and freelance adjustments are dropped: they are the freelance
-- ask now, and applying them on top would count them twice. Anything not set
-- here takes the page's defaults when it is read.
--
-- Each converted profile gets a new `date_updated`, because its snapshot in
-- `collected_data` still holds the old columns and the worker rebuilds a
-- snapshot only when its profile is newer. Until then the loader hides keys
-- the export no longer writes (`withCurrentKeys`, ai-chat/profile-data.ts).
--
-- `fromLegacySalarySettings` does the same for an export taken before this, and
-- its tests pin the result for the real rows. 0071 drops the old columns.
ALTER TABLE "profiles" ADD COLUMN "salary_employed" jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "salary_freelance" jsonb;--> statement-breakpoint
WITH old AS (
	SELECT
		p."id",
		p."salary_base_rate"::numeric AS base,
		CASE
			WHEN upper(trim(p."salary_currency")) ~ '^[A-Z]{3}$' THEN upper(trim(p."salary_currency"))
			ELSE 'EUR'
		END AS currency,
		coalesce(
			CASE
				WHEN (p."salary_adjustments"::jsonb #>> '{employment_type,contract}') ~ '^-?[0-9]+(\.[0-9]+)?$'
				THEN (p."salary_adjustments"::jsonb #>> '{employment_type,contract}')::numeric
			END,
			CASE
				WHEN (p."salary_adjustments"::jsonb #>> '{employment_type,freelance}') ~ '^-?[0-9]+(\.[0-9]+)?$'
				THEN (p."salary_adjustments"::jsonb #>> '{employment_type,freelance}')::numeric
			END,
			0
		) AS contract_pct,
		CASE
			WHEN jsonb_typeof(p."salary_region_overrides"::jsonb) = 'object' THEN p."salary_region_overrides"::jsonb
			ELSE '{}'::jsonb
		END AS regions,
		CASE
			WHEN jsonb_typeof(p."salary_income_assumptions") = 'object'
				AND p."salary_income_assumptions" <> '{}'::jsonb
			THEN p."salary_income_assumptions"
		END AS income
	FROM "profiles" AS p
	WHERE p."salary_base_rate" > 0
),
region_rates AS (
	SELECT
		old."id",
		r.key AS region,
		CASE
			WHEN (r.value ->> 'rate') ~ '^[0-9]+(\.[0-9]+)?$' THEN (r.value ->> 'rate')::numeric
			ELSE 0
		END AS rate,
		coalesce(r.value ->> 'currency', old.currency) AS currency
	FROM old, jsonb_each(old.regions) AS r
	WHERE jsonb_typeof(r.value) = 'object'
)
UPDATE "profiles" AS p
SET
	"salary_employed" = jsonb_strip_nulls(jsonb_build_object(
		'amount', round(old.base * 174),
		'period', 'month',
		'currency', old.currency,
		'taxPct', old.income -> 'employmentTaxPct',
		'regions', coalesce((
			SELECT jsonb_object_agg(
				rr.region,
				jsonb_build_object('amount', round(rr.rate * 174), 'currency', rr.currency)
			)
			FROM region_rates AS rr
			WHERE rr."id" = old."id"
		), '{}'::jsonb)
	)),
	"salary_freelance" = jsonb_strip_nulls(jsonb_build_object(
		'amount', round(old.base * (100 + old.contract_pct) / 100),
		'unit', 'hour',
		'currency', old.currency,
		'billableHours', old.income -> 'freelanceBillableHours',
		'taxPct', old.income -> 'freelanceDeductionPct',
		'costsPerYear', CASE WHEN old.income IS NOT NULL THEN 0 END,
		'regions', coalesce((
			SELECT jsonb_object_agg(
				rr.region,
				jsonb_build_object(
					'amount', round(rr.rate * (100 + old.contract_pct) / 100),
					'currency', rr.currency
				)
			)
			FROM region_rates AS rr
			WHERE rr."id" = old."id"
		), '{}'::jsonb)
	)),
	"date_updated" = now()
FROM old
WHERE p."id" = old."id";--> statement-breakpoint
UPDATE "profiles"
SET "salary_adjustments" = (
	"salary_adjustments"::jsonb #- '{employment_type,contract}' #- '{employment_type,freelance}'
)::json
WHERE jsonb_typeof("salary_adjustments"::jsonb) = 'object';
