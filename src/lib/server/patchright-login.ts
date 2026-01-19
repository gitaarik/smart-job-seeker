/**
 * Patchright Login Authentication Module
 * Handles LLM-based login field detection and form submission
 */

import type { Page } from "playwright";
import type { z } from "zod";
import { stripHtmlForLlm } from "./html-strip";
import { getPlatformCredentials } from "./platform-auth";
import { dbDirect } from "$lib/db";
import { interpolatePrompt } from "./ai-chat-utils";
import { detectLoginFieldsSchema } from "./schemas/ai-prompt-schemas";
import { generateChatCompletion } from "./llm-langchain";

interface LoginFieldSelectors {
  usernameSelector: string | null;
  passwordSelector: string | null;
  submitSelector: string | null;
  confidence: number;
  warnings?: string[];
}

/**
 * Detect login form fields using LLM
 * @param page Patchright page on login page
 * @returns Field selectors or null if detection fails
 */
export async function detectLoginFields(
  page: Page,
): Promise<LoginFieldSelectors | null> {
  try {
    console.log("🔍 Detecting login form fields...");

    // Get current page HTML
    const html = await page.content();

    // Strip HTML for LLM consumption
    const strippedHtml = await stripHtmlForLlm(html, {
      preserveAttrs: ["id", "name", "type", "class", "placeholder"],
      preserveTags: [
        "form",
        "input",
        "button",
        "label",
        "a",
        "div",
        "span",
        "h1",
        "h2",
        "h3",
      ],
      maxTokens: 10000,
    });

    // Fetch prompt template
    const promptTemplate = await dbDirect.ai_chat_prompts.findUnique({
      where: { request: "detect_login_fields" },
    });

    if (!promptTemplate) {
      throw new Error("Prompt template 'detect_login_fields' not found");
    }

    // Interpolate variables
    const systemPrompt = interpolatePrompt(
      promptTemplate.system_prompt || "",
      {},
    );
    const userPrompt = interpolatePrompt(promptTemplate.user_prompt || "", {
      html: strippedHtml,
    });

    // Call LLM with structured output
    const response = await generateChatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      {
        structuredOutput: {
          name: "detect_login_fields",
          schema: detectLoginFieldsSchema,
        },
      },
    ) as z.infer<typeof detectLoginFieldsSchema>;

    console.log(
      `   Confidence: ${(response.confidence * 100).toFixed(0)}%`,
    );

    if (response.warnings && response.warnings.length > 0) {
      console.log(`   ⚠️  Warnings: ${response.warnings.join(", ")}`);
    }

    return response;
  } catch (error) {
    console.error(
      "❌ Failed to detect login fields:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

/**
 * Fill and submit login form
 * @param page Patchright page
 * @param credentials Username and password
 * @param fieldSelectors Detected field selectors
 * @returns Whether login form submission succeeded
 */
export async function fillLoginForm(
  page: Page,
  credentials: { username: string; password: string },
  fieldSelectors: {
    usernameSelector: string;
    passwordSelector: string;
    submitSelector: string;
  },
): Promise<boolean> {
  try {
    console.log("📝 Filling login form...");

    // Common fallback selectors for popular platforms
    const usernameFallbacks = [
      fieldSelectors.usernameSelector,
      'input[name="session_key"]', // LinkedIn
      'input[name="username"]',
      'input[name="email"]',
      "#username",
      "#email",
      'input[type="email"]',
      'input[autocomplete="username"]',
    ];

    const passwordFallbacks = [
      fieldSelectors.passwordSelector,
      'input[name="session_password"]', // LinkedIn
      'input[name="password"]',
      "#password",
      'input[type="password"]',
      'input[autocomplete="current-password"]',
    ];

    const submitFallbacks = [
      fieldSelectors.submitSelector,
      'button[type="submit"]',
      "button[data-litms-control-urn]", // LinkedIn specific
      'button:has-text("Sign in")',
      'button:has-text("Log in")',
      'input[type="submit"]',
    ];

    // Try username field with fallbacks
    let usernameSuccess = false;
    for (const selector of usernameFallbacks) {
      try {
        await page.fill(selector, credentials.username, { timeout: 2000 });
        console.log(`   ✓ Username field filled (${selector})`);
        usernameSuccess = true;
        break;
      } catch (e) {
        // Try next selector
        continue;
      }
    }

    if (!usernameSuccess) {
      console.error("   ❌ Could not find username field");
      return false;
    }

    // Try password field with fallbacks
    let passwordSuccess = false;
    for (const selector of passwordFallbacks) {
      try {
        await page.fill(selector, credentials.password, { timeout: 2000 });
        console.log(`   ✓ Password field filled (${selector})`);
        passwordSuccess = true;
        break;
      } catch (e) {
        // Try next selector
        continue;
      }
    }

    if (!passwordSuccess) {
      console.error("   ❌ Could not find password field");
      return false;
    }

    // Try submit button with fallbacks
    let submitSuccess = false;
    for (const selector of submitFallbacks) {
      try {
        await page.click(selector, { timeout: 2000 });
        console.log(`   ✓ Submit button clicked (${selector})`);
        submitSuccess = true;
        break;
      } catch (e) {
        // Try next selector
        continue;
      }
    }

    // If we couldn't find submit button, try pressing Enter on password field
    if (!submitSuccess) {
      console.log("   ⌨️  Trying Enter key as fallback...");
      try {
        for (const selector of passwordFallbacks) {
          try {
            await page.press(selector, "Enter", { timeout: 2000 });
            console.log(`   ✓ Enter key pressed on password field`);
            submitSuccess = true;
            break;
          } catch (e) {
            continue;
          }
        }
      } catch (e) {
        // Enter key didn't work either
      }
    }

    if (!submitSuccess) {
      console.warn(
        "   ⚠️  Could not find submit button, but form may have auto-submitted",
      );
      // Don't return false - the form might have submitted anyway
    }

    // Wait for navigation or network idle (login usually triggers navigation)
    try {
      await Promise.race([
        page.waitForNavigation({ timeout: 10000 }),
        page.waitForLoadState("networkidle", { timeout: 10000 }),
      ]);
    } catch (timeoutError) {
      // Navigation timeout is not necessarily an error (SPA might not navigate)
      console.log("   ⏱️  Navigation timeout (may be normal for SPAs)");
    }

    // Check if we're still on a login page (indicates failure)
    const currentUrl = page.url();
    if (
      currentUrl.includes("/login") || currentUrl.includes("/signin") ||
      currentUrl.includes("/auth")
    ) {
      console.log("   ⚠️  Still on login page - login may have failed");
      return false;
    }

    console.log("   ✅ Login form submitted successfully");
    return true;
  } catch (error) {
    console.error(
      "❌ Failed to fill login form:",
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

/**
 * Main login orchestration function
 * Combines field detection, form filling, and success verification
 * @param page Patchright page
 * @param platformId Platform ID for login URL lookup
 * @param profileId Profile ID for credential lookup
 * @returns Whether login was successful
 */
export async function performPatchwrightLogin(
  page: Page,
  platformId: number,
  profileId: number,
): Promise<boolean> {
  try {
    console.log(`\n🔐 Attempting login for platform ${platformId}...`);

    // Get credentials
    const credentials = await getPlatformCredentials(profileId, platformId);
    if (!credentials || !credentials.username || !credentials.password) {
      console.log("   ℹ️  No credentials found - skipping login");
      return false;
    }

    // Get platform record
    const platform = await dbDirect.job_platforms.findUnique({
      where: { id: platformId },
      select: { login_page_url: true, url: true, name: true },
    });

    if (!platform) {
      console.error(`   ❌ Platform ${platformId} not found`);
      return false;
    }

    // Determine login URL
    let loginUrl = platform.login_page_url;
    if (!loginUrl) {
      console.log("   ℹ️  No login URL configured - skipping login");
      return false;
    }

    // Navigate to login page
    console.log(`   🌐 Navigating to: ${loginUrl}`);
    await page.goto(loginUrl);
    await page.waitForLoadState("domcontentloaded");

    // Detect login fields
    const fieldSelectors = await detectLoginFields(page);

    if (!fieldSelectors) {
      console.error("   ❌ Failed to detect login fields");
      return false;
    }

    // Check confidence threshold
    if (fieldSelectors.confidence < 0.7) {
      console.warn(
        `   ⚠️  Low confidence (${
          (fieldSelectors.confidence * 100).toFixed(0)
        }%) - skipping login`,
      );
      return false;
    }

    // Check for warnings (CAPTCHA, 2FA, etc.)
    if (fieldSelectors.warnings && fieldSelectors.warnings.length > 0) {
      const hasCaptcha = fieldSelectors.warnings.some((w) =>
        w.toLowerCase().includes("captcha")
      );
      if (hasCaptcha) {
        throw new Error(
          "CAPTCHA detected on login page - manual intervention required",
        );
      }
    }

    // Validate that we got all required selectors
    if (
      !fieldSelectors.usernameSelector ||
      !fieldSelectors.passwordSelector ||
      !fieldSelectors.submitSelector
    ) {
      console.error("   ❌ Missing required field selectors");
      return false;
    }

    // Fill and submit form
    const submitSuccess = await fillLoginForm(
      page,
      credentials,
      {
        usernameSelector: fieldSelectors.usernameSelector,
        passwordSelector: fieldSelectors.passwordSelector,
        submitSelector: fieldSelectors.submitSelector,
      },
    );

    if (submitSuccess) {
      console.log("   ✅ Login successful");
      return true;
    } else {
      console.log("   ⚠️  Login may have failed");
      return false;
    }
  } catch (error) {
    console.error(
      "❌ Login failed:",
      error instanceof Error ? error.message : String(error),
    );

    // Rethrow CAPTCHA errors
    if (
      error instanceof Error &&
      error.message.includes("CAPTCHA")
    ) {
      throw error;
    }

    return false;
  }
}
