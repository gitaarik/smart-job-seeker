/**
 * Email Verification Parser
 *
 * Extracts verification codes and links from forwarded emails.
 * Uses pattern matching first (fast, no cost), falls back to LLM if needed.
 */

import * as cheerio from "cheerio";

export interface ParsedVerification {
  code?: string;
  link?: string;
  confidence: "high" | "medium" | "low";
}

/**
 * Known verification link URL patterns.
 * Order matters — more specific patterns first.
 */
const VERIFICATION_LINK_PATTERNS = [
  // Common verification/auth URL patterns
  /https?:\/\/[^\s"'<>]+(?:verify|confirm|validate|activate|auth|token|magic|login|signin|sign-in|one-time|otp|sso|callback)[^\s"'<>]*/gi,
  // URLs with typical verification query params
  /https?:\/\/[^\s"'<>]+[?&](?:code|token|key|otp|nonce|hash|signature|verify|confirm)=[^\s"'<>&]+/gi,
  // URLs wrapped in angle brackets (common in plain text emails): <https://...>
  /<(https?:\/\/[^>]+)>/gi,
];

/**
 * Patterns that indicate a URL is NOT a verification link
 * (unsubscribe, privacy policy, help, etc.)
 */
const LINK_EXCLUDE_PATTERNS = [
  /unsubscribe/i,
  /manage.?preferences/i,
  /privacy/i,
  /terms/i,
  /help/i,
  /support/i,
  /faq/i,
  /logo/i,
  /tracking/i,
  /pixel/i,
  /\.(?:png|jpg|jpeg|gif|svg|ico|css|js)(?:\?|$)/i,
  /^https?:\/\/static\./i,       // Static asset subdomains (static.licdn.com, etc.)
  /^https?:\/\/cdn\./i,          // CDN subdomains (cdn.example.com)
  /^https?:\/\/assets\./i,       // Asset subdomains
  /^https?:\/\/media\./i,        // Media subdomains
];

/**
 * Patterns for extracting verification codes from email text.
 * Each pattern has a named capture group `code`.
 */
const CODE_PATTERNS = [
  // "Your verification code is: 123456" / "code: 123456"
  /(?:verification|security|login|sign.?in|one.?time|otp|2fa|two.?factor)\s*(?:code|pin|number)\s*(?:is|:)\s*[:\s]*(?<code>\d{4,8})/i,
  // "Enter code 123456" / "Use code: 123456"
  /(?:enter|use|type|input|submit)\s+(?:the\s+)?(?:code|pin|number)\s*[:\s]*(?<code>\d{4,8})/i,
  // "123456 is your verification code"
  /(?<code>\d{4,8})\s+is\s+your\s+(?:verification|security|login|one.?time)\s*(?:code|pin)/i,
  // "Code: 123456" (standalone)
  /^(?:code|pin|otp)\s*[:\s]+(?<code>\d{4,8})\s*$/mi,
  // Alphanumeric codes like "A1B-2C3" or "ABC123"
  /(?:verification|security|login)\s*(?:code|pin)\s*(?:is|:)\s*[:\s]*(?<code>[A-Z0-9]{3,4}[-\s]?[A-Z0-9]{3,4})/i,
  // Standalone prominent number (6 digits, likely OTP) — lower confidence
  /\b(?<code>\d{6})\b/,
];

/**
 * Extract verification data from email content.
 * Tries pattern matching first (fast), then LLM fallback (slower but handles unknown formats).
 */
export async function parseVerificationEmail(
  subject: string | null,
  bodyText: string | null,
  bodyHtml: string | null,
): Promise<ParsedVerification | null> {
  // Strategy 1: Pattern matching (fast, no cost)
  const patternResult = parseWithPatterns(subject, bodyText, bodyHtml);
  if (patternResult) return patternResult;

  // Strategy 2: LLM extraction fallback (handles unknown email formats)
  const llmResult = await parseWithLLM(subject, bodyText, bodyHtml);
  if (llmResult) return llmResult;

  return null;
}

/**
 * Pattern-based extraction (synchronous, fast).
 */
function parseWithPatterns(
  subject: string | null,
  bodyText: string | null,
  bodyHtml: string | null,
): ParsedVerification | null {
  // Try plain text body first (cleaner, easier to parse)
  if (bodyText) {
    const result = extractFromText(bodyText, subject);
    if (result) return result;
  }

  // Fall back to HTML body (strip tags, then parse)
  if (bodyHtml) {
    const result = extractFromHtml(bodyHtml, subject);
    if (result) return result;
  }

  return null;
}

/**
 * LLM-based extraction fallback.
 * Sends email content to a fast model to extract verification codes/links.
 */
async function parseWithLLM(
  subject: string | null,
  bodyText: string | null,
  bodyHtml: string | null,
): Promise<ParsedVerification | null> {
  try {
    // Lazy import to avoid circular dependencies and keep the module light
    const { generateChatCompletion } = await import("$lib/server/llm");

    // Build a clean text representation (prefer plain text, fall back to stripped HTML)
    let emailContent = bodyText;
    if (!emailContent && bodyHtml) {
      emailContent = stripHtml(bodyHtml);
    }
    if (!emailContent) return null;

    // Truncate to avoid large token usage
    const maxLen = 2000;
    if (emailContent.length > maxLen) {
      emailContent = emailContent.slice(0, maxLen);
    }

    const prompt = `Extract the verification code or verification/login link from this email. The email may contain a one-time code (OTP), a magic login link, an email verification link, or a confirmation URL.

Return ONLY a JSON object with these fields (omit fields that don't apply):
- "code": the verification code (string of digits or alphanumeric characters)
- "link": the verification or login URL (full URL string)

If you cannot find either a code or a link, return: {"code": null, "link": null}

Subject: ${subject || "(none)"}

Email body:
${emailContent}`;

    const response = await generateChatCompletion(
      [
        { role: "system", content: "You extract verification codes and links from emails. Respond with only valid JSON, no explanation." },
        { role: "user", content: prompt },
      ],
      { temperature: 0, maxTokens: 200 },
    );

    // Parse the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as { code?: string | null; link?: string | null };
    if (!parsed.code && !parsed.link) return null;

    return {
      code: parsed.code || undefined,
      link: parsed.link || undefined,
      confidence: "medium", // LLM extractions are medium confidence
    };
  } catch (error) {
    console.warn("[verification-parser] LLM fallback failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Extract verification data from plain text.
 */
function extractFromText(text: string, subject: string | null): ParsedVerification | null {
  const combinedText = subject ? `${subject}\n${text}` : text;

  // Try to extract a verification code
  const code = extractCode(combinedText);

  // Try to extract a verification link (keyword-matched URLs only)
  let link = extractLink(combinedText);

  // If no code AND no keyword-matched link, try a CTA link fallback.
  // Only do this when there's no code — if we have a code, a non-keyword
  // link is likely just navigation (logo, profile, app store) not verification.
  if (!code && !link && isVerificationContext(combinedText)) {
    link = extractCtaLink(combinedText);
  }

  if (!code && !link) return null;

  // Determine confidence
  let confidence: ParsedVerification["confidence"] = "medium";
  if (code && isVerificationContext(combinedText)) {
    confidence = "high";
  } else if (link && isVerificationContext(combinedText)) {
    confidence = "high";
  }

  return { code: code || undefined, link: link || undefined, confidence };
}

/**
 * Extract verification data from HTML email body.
 */
function extractFromHtml(html: string, subject: string | null): ParsedVerification | null {
  // Extract links from href attributes (preserves full URLs)
  const links = extractLinksFromHtml(html);
  let verificationLink = links.find((url) => isValidUrl(url) && isVerificationUrl(url) && !isExcludedUrl(url));

  // Strip HTML to get text content for code extraction
  const text = stripHtml(html);
  const combinedText = subject ? `${subject}\n${text}` : text;
  const code = extractCode(combinedText);

  // If no code AND no keyword-matched link, try any non-excluded link as CTA.
  // Only do this when there's no code — if we have a code, a non-keyword
  // link is likely just navigation (logo, profile, app store) not verification.
  if (!code && !verificationLink && isVerificationContext(combinedText)) {
    verificationLink = links.find((url) => isValidUrl(url) && !isExcludedUrl(url));
  }

  if (!code && !verificationLink) return null;

  const confidence = isVerificationContext(combinedText) ? "high" : "medium";

  return {
    code: code || undefined,
    link: verificationLink || undefined,
    confidence,
  };
}

/**
 * Extract a verification code from text.
 */
function extractCode(text: string): string | null {
  for (const pattern of CODE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.groups?.code) {
      return match.groups.code.replace(/[-\s]/g, "").trim();
    }
  }
  return null;
}

/**
 * Extract a verification link from text.
 */
function extractLink(text: string): string | null {
  for (const pattern of VERIFICATION_LINK_PATTERNS) {
    // Reset regex state (global flag)
    pattern.lastIndex = 0;
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const url = match[0].replace(/[.,;:!?)]+$/, ""); // Trim trailing punctuation
      if (isValidUrl(url) && isVerificationUrl(url) && !isExcludedUrl(url)) {
        return url;
      }
    }
  }
  return null;
}

/**
 * Extract the primary CTA (call-to-action) link from plain text.
 * Used when no keyword-matched link is found but the email context is clearly verification.
 * Looks for URLs in angle brackets (common in plain text emails) and picks the first
 * non-excluded one.
 */
function extractCtaLink(text: string): string | null {
  const angleBracketUrls = [...text.matchAll(/<(https?:\/\/[^>]+)>/gi)];
  for (const match of angleBracketUrls) {
    const url = match[1];
    if (isValidUrl(url) && !isExcludedUrl(url)) {
      return url;
    }
  }
  // Also try bare URLs
  const bareUrls = [...text.matchAll(/https?:\/\/[^\s"'<>]+/gi)];
  for (const match of bareUrls) {
    const url = match[0].replace(/[.,;:!?)]+$/, "");
    if (isValidUrl(url) && !isExcludedUrl(url)) {
      return url;
    }
  }
  return null;
}

/**
 * Extract all href URLs from HTML using Cheerio (proper HTML parser).
 * Regex-based href extraction breaks on complex email HTML (e.g. LinkedIn
 * emails with broken markup that concatenates URLs).
 */
function extractLinksFromHtml(html: string): string[] {
  const urls: string[] = [];
  try {
    const $ = cheerio.load(html);
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href && href.startsWith("http")) {
        urls.push(href);
      }
    });
  } catch {
    // Fallback to regex if Cheerio fails (shouldn't happen)
    const hrefPattern = /href\s*=\s*["']([^"']+)["']/gi;
    let match;
    while ((match = hrefPattern.exec(html)) !== null) {
      if (match[1] && match[1].startsWith("http")) {
        urls.push(match[1]);
      }
    }
  }
  return urls;
}

/**
 * Check if a URL looks like a verification/auth link.
 */
function isVerificationUrl(url: string): boolean {
  const lower = url.toLowerCase();
  const keywords = [
    "verify", "confirm", "validate", "activate", "auth",
    "token", "magic", "login", "signin", "sign-in",
    "one-time", "otp", "sso", "callback", "code=",
    "nonce=", "hash=", "key=", "signature=",
  ];
  return keywords.some((kw) => lower.includes(kw));
}

/**
 * Check if a URL should be excluded (unsubscribe, images, etc.)
 */
function isExcludedUrl(url: string): boolean {
  return LINK_EXCLUDE_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Check if a URL is well-formed (parseable, valid protocol).
 * Catches malformed URLs like "https://foo][https://bar" before they reach the scraper.
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    // Reject URLs with embedded URL boundaries — e.g. "https://foo][https://bar"
    // which are two concatenated URLs from broken HTML parsing
    if (/\]\[|https?:\/\/.+https?:\/\//.test(url)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the email text suggests a verification context.
 */
function isVerificationContext(text: string): boolean {
  const lower = text.toLowerCase();
  const contextKeywords = [
    "verification", "verify", "confirm", "one-time",
    "otp", "2fa", "two-factor", "security code",
    "login code", "sign in", "magic link", "access code",
    "authentication", "passcode",
  ];
  return contextKeywords.some((kw) => lower.includes(kw));
}

/**
 * Strip HTML tags to get plain text.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
