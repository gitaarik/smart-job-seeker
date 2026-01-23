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

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Check if an error is a recoverable browser-use error that should trigger manual login fallback.
 * These are typically timeout/CDP issues, not auth failures.
 */
export function isRecoverableBrowserUseError(error: unknown): boolean {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const lowerMsg = errorMsg.toLowerCase();

  // CDP/connection issues
  if (lowerMsg.includes("cdp") && lowerMsg.includes("unresponsive")) {
    return true;
  }
  if (lowerMsg.includes("websocket") && lowerMsg.includes("closed")) {
    return true;
  }

  // Timeout issues (watchdog timeouts, general timeouts)
  if (lowerMsg.includes("timeout")) return true;
  if (lowerMsg.includes("timed out")) return true;

  // Watchdog-specific errors
  if (lowerMsg.includes("watchdog")) return true;
  if (lowerMsg.includes("domwatchdog")) return true;
  if (lowerMsg.includes("screenshotwatchdog")) return true;

  // Event bus errors
  if (lowerMsg.includes("eventbus")) return true;
  if (lowerMsg.includes("event bus")) return true;

  // Connection failures
  if (lowerMsg.includes("connection failed")) return true;
  if (lowerMsg.includes("connection refused")) return true;

  return false;
}

// ============================================================================
// Network Utilities
// ============================================================================

import { promises as dns } from "dns";

/**
 * Resolve hostname to IP address for CDP connection.
 * Chrome DevTools Protocol rejects non-localhost/non-IP Host headers,
 * so we need to resolve the hostname before connecting.
 */
export async function resolveCdpHost(host: string): Promise<string> {
  // If already an IP address or localhost, return as-is
  if (
    host === "localhost" || host === "127.0.0.1" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  ) {
    return host;
  }

  try {
    const addresses = await dns.lookup(host);
    console.log(`🔍 Resolved ${host} to ${addresses.address}`);
    return addresses.address;
  } catch (error) {
    console.warn(`⚠️ Could not resolve ${host}, using as-is: ${error}`);
    return host;
  }
}
