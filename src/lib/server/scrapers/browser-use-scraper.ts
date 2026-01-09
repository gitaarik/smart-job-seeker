/**
 * Browser-Use scraper strategy
 * Uses Browser-Use API to directly extract structured job data
 */

import { config } from "$lib/server/config";
import { BrowserUseClient } from "$lib/server/browser-use-client";
import { upsertJob } from "$lib/server/job-scraper";
import { parseRelativeDate } from "$lib/tools/date-utils";
import { isJobClosed, isJobTooOld } from "$lib/server/scrape-filters";
import { interpolatePrompt } from "$lib/server/ai-chat-utils";
import { dbDirect } from "$lib/db";

/**
 * Parse Browser-Use response with multiple fallback strategies
 * Tries direct parsing, regex extraction, and JSON repair
 */
function parseBrowserUseResponse(result: any): any[] {
  // Strategy 1: Already an array (direct response)
  if (Array.isArray(result)) {
    return result;
  }

  // Strategy 2: Already parsed object with jobs property
  if (typeof result === "object" && result !== null) {
    if (Array.isArray(result.jobs)) {
      return result.jobs;
    }
    if (Array.isArray(result.data)) {
      return result.data;
    }
  }

  // Strategy 3: String that needs parsing
  const resultStr = typeof result === "string"
    ? result
    : JSON.stringify(result);

  // Strategy 3a: Try direct JSON parse
  try {
    const parsed = JSON.parse(resultStr);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed.jobs && Array.isArray(parsed.jobs)) {
      return parsed.jobs;
    }
    if (parsed.data && Array.isArray(parsed.data)) {
      return parsed.data;
    }
  } catch {
    // Continue to regex extraction
  }

  // Strategy 3b: Extract JSON array using regex
  const jsonArrayMatch = resultStr.match(/\[[\s\S]*\]/);
  if (jsonArrayMatch) {
    try {
      const parsed = JSON.parse(jsonArrayMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      throw new Error(
        `Found JSON array pattern but failed to parse: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // Strategy 3c: Extract JSON object with jobs property
  const jsonObjectMatch = resultStr.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    try {
      const parsed = JSON.parse(jsonObjectMatch[0]);
      if (Array.isArray(parsed.jobs)) {
        return parsed.jobs;
      }
      if (Array.isArray(parsed.data)) {
        return parsed.data;
      }
    } catch {
      // Continue to error
    }
  }

  // All strategies failed
  throw new Error(
    `Could not extract job array from Browser-Use response. Response type: ${typeof result}, ` +
      `preview: ${resultStr.substring(0, 200)}...`,
  );
}

/**
 * BROWSER-USE SCRAPING (Unified for both URL and Click modes)
 * Uses Browser-Use API to directly extract structured job data
 */
export async function scrapeJobsWithBrowserUse(
  searchUrl: string,
  navigationType: "url" | "click",
  platformId: string,
  profileId?: number,
  sendScreenshots?: boolean,
): Promise<number> {
  console.log(`\n🤖 Using Browser-Use (${navigationType} mode)...`);

  // Use default config automatically
  const browserUse = new BrowserUseClient(
    sendScreenshots !== undefined
      ? { sendScreenshots }
      : undefined,
  );

  // Get platform information
  const platform = await dbDirect.job_platforms.findUnique({
    where: { id: Number(platformId) },
  });

  if (!platform) {
    throw new Error(`Platform with ID ${platformId} not found`);
  }

  // Check for credentials if profileId is provided
  let credentials: { username: string; password: string } | null = null;
  if (profileId && platformId) {
    const { getPlatformCredentials } = await import("../platform-auth");
    const creds = await getPlatformCredentials(
      profileId,
      Number(platformId),
    );

    if (creds?.username && creds?.password) {
      console.log(
        `🔐 Credentials found for platform - will login automatically`,
      );
      credentials = creds;
    } else {
      console.log(`ℹ️  No credentials found - will scrape without login`);
    }
  }

  // STEP 1: Navigate to the platform website manually (let Browser-Use open the browser)
  console.log(`\n📍 Step 1: Opening platform website: ${platform.url}`);
  await browserUse.executeTask({
    task: `Navigate to ${platform.url} and wait for the page to load.`,
    startUrl: platform.url,
    maxTime: 30, // 30 seconds
  });

  // STEP 2: Navigate to login page (if credentials are available)
  if (credentials) {
    console.log(`\n🔑 Step 2: Navigating to login page`);
    await browserUse.executeTask({
      task: `Find and click the login or sign-in button/link to navigate to the login page or open the login popup. Common locations: top-right corner of the page, navigation menu, or prominent button on homepage.`,
      startUrl: platform.url, // Stay on current page
      maxTime: 30, // 30 seconds
    });

    // STEP 3: Login with credentials
    console.log(`\n🔐 Step 3: Logging in with credentials`);
    await browserUse.executeTask({
      task: `Fill in the login form and submit it:
1. Find the username/email input field and enter: ${credentials.username}
2. Find the password input field and enter: ${credentials.password}
3. Find and click the submit/login button
4. Wait for successful login (look for profile menu, logout button, or redirect to dashboard)`,
      startUrl: platform.url, // Stay on current page
      maxTime: 60, // 1 minute
    });

    console.log(`✅ Login successful, now navigating to job search...`);
  }

  // STEP 4: Navigate to job search page and extract jobs
  console.log(`\n🔍 Step 4: Extracting jobs from search page`);

  // Fetch prompt template from Directus
  const template = await dbDirect.ai_chat_prompts.findUnique({
    where: { request: "extract_job_browser_use" },
  });

  if (!template) {
    throw new Error(
      "Prompt template 'extract_job_browser_use' not found in ai_chat_prompts",
    );
  }

  // Build navigation instructions based on mode
  const navigationInstructions = navigationType === "url"
    ? `Navigate through pagination links/buttons to find more jobs. Stop after finding ${config.scraperMaxJobsPerSearch} jobs or ${config.scraperPaginationMaxPages} pages.`
    : `Click on each job card to view details. Stop after finding ${config.scraperMaxJobsPerSearch} jobs.`;

  // Interpolate variables in the user prompt
  const systemPrompt = template.system_prompt || "";
  const userPrompt = interpolatePrompt(template.user_prompt || "", {
    navigationInstructions,
  });

  // Combine system and user prompts for the Browser-Use task
  const task = `${systemPrompt}\n\n${userPrompt}`.trim();

  console.log("Executing extraction task:\n\n", task);

  // Execute the extraction task
  const response = await browserUse.executeTask({
    task,
    startUrl: searchUrl,
    maxTime: 180, // 3 minutes max
  });

  // Parse the JSON result with multiple fallback strategies
  let jobs: any[];
  try {
    jobs = parseBrowserUseResponse(response.result);
  } catch (error) {
    console.error("❌ Failed to parse Browser-Use response:", error);
    console.log(
      "Raw response:",
      JSON.stringify(response.result).substring(0, 500),
    );
    throw error;
  }

  // Validate job structure
  if (!Array.isArray(jobs)) {
    throw new Error(
      `Browser-Use response is not an array, got: ${typeof jobs}`,
    );
  }

  console.log(`✅ Browser-Use extracted ${jobs.length} jobs`);

  // Apply filters and save
  let processedCount = 0;
  for (const jobData of jobs) {
    // Parse date_posted if it's a string
    const datePosted = jobData.date_posted
      ? parseRelativeDate(jobData.date_posted)
      : null;

    // Apply filters
    if (isJobTooOld(datePosted, config.scraperMaxJobAge)) {
      console.log(`   ⏭️  Skipping - too old: ${jobData.title}`);
      continue;
    }
    if (isJobClosed(jobData.status)) {
      console.log(`   ⏭️  Skipping - closed: ${jobData.title}`);
      continue;
    }

    // Save using existing logic
    await upsertJob(
      {
        ...jobData,
        date_posted: datePosted,
      },
      jobData.application_url,
      platformId,
    );
    processedCount++;
  }

  return processedCount;
}
