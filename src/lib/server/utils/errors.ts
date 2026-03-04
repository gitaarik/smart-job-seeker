/**
 * Shared error formatting utilities
 */

/**
 * Extract error message from an unknown error value.
 * Safely handles Error instances and other thrown values.
 */
export function getErrorMessage(error: unknown, fallback = "Unknown error"): string {
  return error instanceof Error ? error.message : fallback;
}
