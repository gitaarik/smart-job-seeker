/**
 * Salary conversion utilities (shared client/server)
 *
 * Converts a base hourly rate to any period, applies percentage adjustments,
 * and handles basic currency conversion.
 */

// Standard working assumptions
const HOURS_PER_DAY = 8;
const DAYS_PER_WEEK = 5;
const DAYS_PER_MONTH = 21.75; // ~261 working days / 12
const MONTHS_PER_YEAR = 12;

/** Canonical salary periods. "project" means a fixed-price/one-time amount. */
export type SalaryPeriod = "hour" | "day" | "week" | "month" | "year" | "project";

/** Map raw salary_period strings to canonical values */
const PERIOD_ALIASES: Record<string, SalaryPeriod> = {
  hour: "hour",
  hourly: "hour",
  hr: "hour",
  "/hr": "hour",
  "p/h": "hour",
  day: "day",
  daily: "day",
  "/day": "day",
  week: "week",
  weekly: "week",
  "/week": "week",
  month: "month",
  monthly: "month",
  "/month": "month",
  "/mo": "month",
  year: "year",
  yearly: "year",
  annual: "year",
  annually: "year",
  "/year": "year",
  "/yr": "year",
  "p.a.": "year",
  "per annum": "year",
  "fixed-price": "project",
  "fixed price": "project",
  "one-time": "project",
  project: "project",
  "one time": "project",
};

/**
 * Normalize a raw salary_period string to a canonical SalaryPeriod.
 * Returns null if the value is unrecognized.
 */
export function normalizeSalaryPeriod(raw: string | null | undefined): SalaryPeriod | null {
  if (!raw) return null;
  return PERIOD_ALIASES[raw.toLowerCase().trim()] ?? null;
}

/** Human-readable labels for salary periods */
const PERIOD_LABELS: Record<SalaryPeriod, string> = {
  hour: "hour",
  day: "day",
  week: "week",
  month: "month",
  year: "year",
  project: "fixed price",
};

/**
 * Format a salary period for display. Returns empty string for null/unknown.
 */
export function formatSalaryPeriod(raw: string | null | undefined): string {
  const period = normalizeSalaryPeriod(raw);
  if (!period) return "";
  return PERIOD_LABELS[period];
}

export type SalaryAdjustments = {
  employment_type?: Record<string, number>;
  work_arrangement?: Record<string, number>;
  company_type?: Record<string, number>;
};

export type SalaryRegionOverride = { rate: number; currency: string };
export type SalaryRegionOverrides = Record<string, SalaryRegionOverride>;

/** Default currencies per region. Regions not listed default to EUR. */
export const REGION_CURRENCIES: Record<string, string> = {
  us: "USD",
  uk: "GBP",
  western_europe: "EUR",
  eastern_europe: "EUR",
  middle_east: "USD",
  asia_pacific: "USD",
  latin_america: "USD",
  africa: "USD",
};

/**
 * Convert hourly rate to any period.
 * "project" is not convertible — returns the hourly rate as-is.
 */
export function hourlyToRate(hourlyRate: number, period: SalaryPeriod): number {
  switch (period) {
    case "hour":
      return hourlyRate;
    case "day":
      return Math.round(hourlyRate * HOURS_PER_DAY);
    case "week":
      return Math.round(hourlyRate * HOURS_PER_DAY * DAYS_PER_WEEK);
    case "month":
      return Math.round(hourlyRate * HOURS_PER_DAY * DAYS_PER_MONTH);
    case "year":
      return Math.round(hourlyRate * HOURS_PER_DAY * DAYS_PER_MONTH * MONTHS_PER_YEAR);
    case "project":
      return hourlyRate;
  }
}

/**
 * Convert any rate back to hourly.
 * "project" is not convertible — returns the amount as-is.
 */
export function rateToHourly(amount: number, period: SalaryPeriod): number {
  switch (period) {
    case "hour":
      return amount;
    case "day":
      return amount / HOURS_PER_DAY;
    case "week":
      return amount / (HOURS_PER_DAY * DAYS_PER_WEEK);
    case "month":
      return amount / (HOURS_PER_DAY * DAYS_PER_MONTH);
    case "year":
      return amount / (HOURS_PER_DAY * DAYS_PER_MONTH * MONTHS_PER_YEAR);
    case "project":
      return amount;
  }
}

/**
 * Approximate currency conversion rates (EUR-based).
 */
const EUR_RATES: Record<string, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.86,
};

export function convertCurrency(amount: number, from: string, to: string): number {
  if (from === to) return amount;
  const fromRate = EUR_RATES[from];
  const toRate = EUR_RATES[to];
  if (!fromRate || !toRate) return amount;
  return Math.round((amount / fromRate) * toRate);
}

/**
 * Calculate effective hourly rate with adjustments applied.
 * Returns { rate, currency } — the currency may differ from the global
 * base currency when a region override is active.
 */
export function getEffectiveRate(
  baseRate: number,
  baseCurrency: string,
  adjustments: SalaryAdjustments | null | undefined,
  regionOverrides: SalaryRegionOverrides | null | undefined,
  context: {
    employment_type?: string;
    work_arrangement?: string;
    company_type?: string;
    region?: string;
  },
): { rate: number; currency: string } {
  let effectiveCurrency = baseCurrency;

  if (context.region && regionOverrides?.[context.region] != null) {
    const override = regionOverrides[context.region];
    baseRate = override.rate;
    effectiveCurrency = override.currency;
  }

  if (!adjustments) return { rate: baseRate, currency: effectiveCurrency };

  let totalAdjustment = 0;

  if (context.employment_type && adjustments.employment_type?.[context.employment_type] != null) {
    totalAdjustment += adjustments.employment_type[context.employment_type];
  }

  if (context.work_arrangement && adjustments.work_arrangement?.[context.work_arrangement] != null) {
    totalAdjustment += adjustments.work_arrangement[context.work_arrangement];
  }

  if (context.company_type && adjustments.company_type?.[context.company_type] != null) {
    totalAdjustment += adjustments.company_type[context.company_type];
  }

  return {
    rate: Math.round(baseRate * (1 + totalAdjustment / 100)),
    currency: effectiveCurrency,
  };
}

/**
 * Get all rates for display
 */
export function getAllRates(effective: { rate: number; currency: string }) {
  return {
    hourly: effective.rate,
    daily: hourlyToRate(effective.rate, "day"),
    monthly: hourlyToRate(effective.rate, "month"),
    yearly: hourlyToRate(effective.rate, "year"),
    currency: effective.currency,
  };
}

/**
 * Convert a project total price to an equivalent hourly rate using duration.
 * Returns null if conversion isn't possible.
 */
export function projectToHourly(
  totalAmount: number,
  durationWeeks: number,
): number {
  const totalHours = durationWeeks * DAYS_PER_WEEK * HOURS_PER_DAY;
  return totalAmount / totalHours;
}

/**
 * Compare salary expectation against job range.
 * For project/fixed-price jobs with known duration, converts to hourly for comparison.
 * Returns "unknown" when comparison isn't possible.
 */
export function compareSalary(
  askAmount: number,
  askCurrency: string,
  askPeriod: SalaryPeriod,
  jobMin: number | null,
  jobMax: number | null,
  jobCurrency: string | null,
  jobPeriod: string | null,
  jobDurationWeeks?: number | null,
): "within" | "above" | "below" | "unknown" {
  if (jobMin == null && jobMax == null) return "unknown";

  const jCurrency = jobCurrency || "EUR";
  const jPeriod = normalizeSalaryPeriod(jobPeriod) || "year";

  // Can't compare if the user's period is "project"
  if (askPeriod === "project") return "unknown";

  // For project jobs: convert to hourly using duration, then compare
  if (jPeriod === "project") {
    if (!jobDurationWeeks || jobDurationWeeks <= 0) return "unknown";

    const askHourly = rateToHourly(askAmount, askPeriod);
    const askConverted = convertCurrency(askHourly, askCurrency, jCurrency);
    const askTotal = askConverted * jobDurationWeeks * DAYS_PER_WEEK * HOURS_PER_DAY;

    if (jobMin != null && jobMax != null) {
      if (askTotal < jobMin) return "below";
      if (askTotal > jobMax) return "above";
      return "within";
    }
    if (jobMin != null) return askTotal < jobMin ? "below" : "within";
    if (jobMax != null) return askTotal > jobMax ? "above" : "within";
    return "unknown";
  }

  const askHourly = rateToHourly(askAmount, askPeriod);
  const askConverted = convertCurrency(askHourly, askCurrency, jCurrency);
  const askInJobPeriod = hourlyToRate(askConverted, jPeriod);

  if (jobMin != null && jobMax != null) {
    if (askInJobPeriod < jobMin) return "below";
    if (askInJobPeriod > jobMax) return "above";
    return "within";
  }

  if (jobMin != null) {
    return askInJobPeriod < jobMin ? "below" : "within";
  }

  if (jobMax != null) {
    return askInJobPeriod > jobMax ? "above" : "within";
  }

  return "unknown";
}

/**
 * Format a currency amount for display
 */
export function formatCurrency(amount: number | null | undefined, currency: string): string {
  if (amount == null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}
