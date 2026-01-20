/**
 * Shared utilities for job scrapers
 */

import * as readline from "readline";

/**
 * Prompt user for input via CLI
 */
export async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Format salary for display
 * @returns Formatted salary string or "-" if no salary data
 */
export function formatSalary(data: {
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
}): string {
  if (!data.salary_min && !data.salary_max) return "-";
  const min = data.salary_min?.toLocaleString() || "?";
  const max = data.salary_max?.toLocaleString() || "?";
  const curr = data.salary_currency || "";
  const period = data.salary_period ? `/${data.salary_period}` : "";
  return `${curr}${min}-${max}${period}`;
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Check if an error indicates rate limiting
 */
export function isRateLimitError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("rate limit") || message.includes("429") ||
    message.includes("too many requests");
}

/**
 * Constants for scraper configuration
 */
export const SCRAPER_CONSTANTS = {
  /** Percentage threshold for detecting duplicate pages */
  DUPLICATE_PAGE_THRESHOLD_PERCENT: 80,
  /** Maximum depth for logging nested objects */
  MAX_LOGGING_DEPTH: 3,
  /** Maximum string length for truncated logging */
  STRING_TRUNCATE_LENGTH: 1000,
} as const;
