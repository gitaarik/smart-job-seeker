/**
 * Salary conversion utilities (shared client/server)
 *
 * Converts a base hourly rate to any period, applies percentage adjustments,
 * and handles basic currency conversion.
 */

// Standard working assumptions
const HOURS_PER_DAY = 8;
const DAYS_PER_MONTH = 21.75; // ~261 working days / 12
const MONTHS_PER_YEAR = 12;

export type SalaryPeriod = "hour" | "day" | "month" | "year";

export type SalaryAdjustments = {
  employment_type?: Record<string, number>;
  work_arrangement?: Record<string, number>;
  company_type?: Record<string, number>;
};

export type SalaryRegionOverrides = Record<string, number>;

/**
 * Convert hourly rate to any period
 */
export function hourlyToRate(hourlyRate: number, period: SalaryPeriod): number {
  switch (period) {
    case "hour":
      return hourlyRate;
    case "day":
      return Math.round(hourlyRate * HOURS_PER_DAY);
    case "month":
      return Math.round(hourlyRate * HOURS_PER_DAY * DAYS_PER_MONTH);
    case "year":
      return Math.round(hourlyRate * HOURS_PER_DAY * DAYS_PER_MONTH * MONTHS_PER_YEAR);
  }
}

/**
 * Convert any rate back to hourly
 */
export function rateToHourly(amount: number, period: SalaryPeriod): number {
  switch (period) {
    case "hour":
      return amount;
    case "day":
      return amount / HOURS_PER_DAY;
    case "month":
      return amount / (HOURS_PER_DAY * DAYS_PER_MONTH);
    case "year":
      return amount / (HOURS_PER_DAY * DAYS_PER_MONTH * MONTHS_PER_YEAR);
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
 * Calculate effective hourly rate with adjustments applied
 */
export function getEffectiveRate(
  baseRate: number,
  adjustments: SalaryAdjustments | null | undefined,
  regionOverrides: SalaryRegionOverrides | null | undefined,
  context: {
    employment_type?: string;
    work_arrangement?: string;
    company_type?: string;
    region?: string;
  },
): number {
  if (context.region && regionOverrides?.[context.region] != null) {
    baseRate = regionOverrides[context.region];
  }

  if (!adjustments) return baseRate;

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

  return Math.round(baseRate * (1 + totalAdjustment / 100));
}

/**
 * Get all rates for display
 */
export function getAllRates(hourlyRate: number, currency: string) {
  return {
    hourly: hourlyRate,
    daily: hourlyToRate(hourlyRate, "day"),
    monthly: hourlyToRate(hourlyRate, "month"),
    yearly: hourlyToRate(hourlyRate, "year"),
    currency,
  };
}

/**
 * Compare salary expectation against job range
 */
export function compareSalary(
  askAmount: number,
  askCurrency: string,
  askPeriod: SalaryPeriod,
  jobMin: number | null,
  jobMax: number | null,
  jobCurrency: string | null,
  jobPeriod: string | null,
): "within" | "above" | "below" | "unknown" {
  if (jobMin == null && jobMax == null) return "unknown";

  const jCurrency = jobCurrency || "EUR";
  const jPeriod = (jobPeriod || "year") as SalaryPeriod;

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
