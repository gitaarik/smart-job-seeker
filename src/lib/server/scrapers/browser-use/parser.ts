/**
 * Parse Browser-Use AI agent text output into structured results
 */

import type {
  LoginTaskResult,
  NavigateSearchResult,
  PrepareSessionResult,
} from "../types";

// ============================================================================
// Shared Detection Functions
// ============================================================================

/**
 * Detect CAPTCHA indicators in agent output
 */
export function detectCaptcha(text: string): boolean {
  return /captcha|interactive challenge|verify you are human|i am not a robot/i
    .test(text);
}

/**
 * Detect verification requirements in agent output
 */
export function detectVerification(text: string): boolean {
  return /verification.*(code|needed)|2fa|two-factor|enter.*code|authenticator/i
    .test(text);
}

/**
 * Detect verification type from text
 */
export function detectVerificationType(
  text: string,
): "email" | "sms" | "2fa" | null {
  const lower = text.toLowerCase();
  if (/email.*(code|verification)|verification.*email/i.test(lower)) {
    return "email";
  }
  if (/sms|text message|phone.*code/i.test(lower)) return "sms";
  if (/2fa|two-factor|authenticator|otp/i.test(lower)) return "2fa";
  if (/verification.*code|code.*verification/i.test(lower)) return "email"; // default to email
  return null;
}

/**
 * Detect successful login in agent output
 */
export function detectLoggedIn(
  text: string,
  captcha: boolean,
  verification: boolean,
): boolean {
  return !captcha &&
    !verification &&
    /logged in|login successful|successfully (logged|authenticated)|dashboard|authenticated/i
      .test(text);
}

/**
 * Detect readiness for scraping
 */
export function detectReady(
  text: string,
  loggedIn: boolean,
  context: "login" | "search" | "prepare",
): boolean {
  if (context === "search") {
    return /job|search|listing|results|ready/i.test(text);
  }
  // For login and prepare contexts, require login first
  return loggedIn && /job|search|listing|feed|ready/i.test(text);
}

/**
 * Detect if redirected to login page
 */
export function detectRedirectedToLogin(text: string): boolean {
  return /redirected.*login|login.*page|sign.?in.*form/i.test(text);
}

/**
 * Extract URL from text
 */
export function extractUrlFromText(text: string): string {
  const urlMatch = text.match(/https?:\/\/[^\s"'<>]+/i);
  return urlMatch ? urlMatch[0] : "";
}

// ============================================================================
// Result Builders
// ============================================================================

/**
 * Parse login task result from agent output text
 */
export function parseLoginTaskResult(agentOutput: string): LoginTaskResult {
  const captcha = detectCaptcha(agentOutput);
  const verification = detectVerification(agentOutput);
  const loggedIn = detectLoggedIn(agentOutput, captcha, verification);

  return {
    logged_in: loggedIn,
    ready: detectReady(agentOutput, loggedIn, "login"),
    captcha_needed: captcha,
    verification_needed: verification,
    verification_type: verification
      ? detectVerificationType(agentOutput)
      : null,
    current_url: extractUrlFromText(agentOutput),
    reason: agentOutput.slice(0, 300),
  };
}

/**
 * Parse navigate search result from agent output text
 */
export function parseNavigateSearchResult(
  agentOutput: string,
): NavigateSearchResult {
  const captcha = detectCaptcha(agentOutput);
  const redirectedToLogin = detectRedirectedToLogin(agentOutput);
  const ready = !captcha &&
    !redirectedToLogin &&
    /job|search|listing|results|ready/i.test(agentOutput);

  return {
    ready,
    captcha_needed: captcha,
    redirected_to_login: redirectedToLogin,
    current_url: extractUrlFromText(agentOutput),
    reason: agentOutput.slice(0, 300),
  };
}

/**
 * Parse prepare session result from agent output text
 */
export function parsePrepareSessionResult(
  agentOutput: string,
): PrepareSessionResult {
  const captcha = detectCaptcha(agentOutput);
  const verification = detectVerification(agentOutput);
  const loggedIn = detectLoggedIn(agentOutput, captcha, verification);
  const ready = detectReady(agentOutput, loggedIn, "prepare");

  return {
    ready,
    logged_in: loggedIn,
    captcha_needed: captcha,
    verification_needed: verification,
    verification_type: verification
      ? detectVerificationType(agentOutput)
      : null,
    current_url: extractUrlFromText(agentOutput),
    reason: agentOutput.slice(0, 300),
  };
}
