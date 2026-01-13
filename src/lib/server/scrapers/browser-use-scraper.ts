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
 * Extract error message from Browser-Use history response
 */
function extractBrowserUseError(result: any): string | null {
  try {
    // Navigate to the error in the history structure
    if (
      result.history && Array.isArray(result.history) &&
      result.history.length > 0
    ) {
      // Check all history items for errors (rate limits often appear in later steps)
      for (const historyItem of result.history) {
        if (
          historyItem.result && Array.isArray(historyItem.result) &&
          historyItem.result.length > 0
        ) {
          for (const stepResult of historyItem.result) {
            if (stepResult.error) {
              return stepResult.error;
            }
          }
        }
      }
    }
  } catch (e) {
    // Fallback to string search
  }
  return null;
}

/**
 * Parse Browser-Use response with multiple fallback strategies
 * Tries direct parsing, regex extraction, and JSON repair
 */
function parseBrowserUseResponse(result: any): any[] {
  // Check if Browser-Use returned an error/history object
  if (typeof result === "object" && result !== null) {
    // Browser-Use always returns a history object - check if it contains an actual error
    const errorMessage = extractBrowserUseError(result);

    // Only treat as error if there's an actual error message
    if (errorMessage) {
      console.error("❌ Browser-Use agent failed");
      console.log(
        "Response:",
        JSON.stringify(result, null, 2).substring(0, 1000),
      );

      const resultStr = errorMessage;

      // Check for rate limit errors with detailed message
      if (
        resultStr.includes("Rate limit") || resultStr.includes("rate limit") ||
        resultStr.includes("429")
      ) {
        // Try to extract the actual rate limit message
        if (errorMessage) {
          // Parse error messages like: "Error code: 429 - {'error': {'message': '...'}}"
          const match = errorMessage.match(/Error code: (\d+) - (.+)/);
          if (match) {
            const errorCode = match[1];
            const errorBody = match[2];

            // Try to extract the actual message from Python dict format or JSON
            // Handle nested quotes by finding the message between 'message': ' and the next ', 'type'
            const messageMatch = errorBody.match(
              /'message':\s*'(.+?)',\s*'type'/,
            );
            if (messageMatch) {
              const actualMessage = messageMatch[1];
              console.error(`\n❌ LLM Rate Limit Error (${errorCode}):`);
              console.error(actualMessage);
              throw new Error(`Browser-Use LLM rate limit: ${actualMessage}`);
            }
          }

          // Fallback: show the raw error
          console.error(`\n❌ Rate Limit Error:\n${errorMessage}`);
          throw new Error(
            `Browser-Use hit LLM API rate limit: ${
              errorMessage.substring(0, 200)
            }`,
          );
        }

        throw new Error(
          "Browser-Use hit LLM API rate limit - check provider and API key",
        );
      }

      // Check for 404/error pages
      if (
        resultStr.includes("404") ||
        resultStr.includes("This page could not be found")
      ) {
        throw new Error(
          "Browser-Use navigated to 404 error page - likely login or navigation failed",
        );
      }

      // Check for login failures
      if (
        resultStr.includes("login failed") ||
        resultStr.includes("authentication failed") ||
        resultStr.includes("invalid credentials") ||
        resultStr.includes("could not log in")
      ) {
        throw new Error(
          "Browser-Use login failed - check credentials or platform may require CAPTCHA/2FA",
        );
      }

      // Show the actual error if available
      if (errorMessage) {
        console.error(
          `\n❌ Browser-Use Error:\n${errorMessage.substring(0, 500)}`,
        );
        throw new Error(
          `Browser-Use agent error: ${errorMessage.substring(0, 200)}`,
        );
      }

      throw new Error(
        "Browser-Use agent returned error/history instead of job data",
      );
    }

    // Check if this is a successful browser-use response with history
    // Browser-Use returns the final result in the top-level 'result' field
    if (result.history && result.result !== undefined) {
      console.log("✅ Browser-Use task completed");

      // The result is the final extracted content
      const finalResult = result.result;

      // If result is already parsed, use it
      if (Array.isArray(finalResult)) {
        return finalResult;
      }
      if (typeof finalResult === "object" && finalResult !== null) {
        if (Array.isArray(finalResult.jobs)) {
          return finalResult.jobs;
        }
        if (Array.isArray(finalResult.data)) {
          return finalResult.data;
        }
      }

      // Otherwise try to parse it as JSON
      if (typeof finalResult === "string") {
        try {
          const parsed = JSON.parse(finalResult);
          if (Array.isArray(parsed)) {
            return parsed;
          }
          if (parsed.jobs && Array.isArray(parsed.jobs)) {
            return parsed.jobs;
          }
        } catch (e) {
          // Continue to other parsing strategies
        }
      }
    }
  }

  // Strategy 1: Already an array (direct response)
  if (Array.isArray(result)) {
    // Validate it's not a history/error array
    if (result.length > 0 && result[0].hasOwnProperty("is_done")) {
      throw new Error(
        "Browser-Use returned history array instead of job data - agent likely failed",
      );
    }
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
 * BROWSER-USE SCRAPING
 * Uses Browser-Use API to extract structured job data
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
    sendScreenshots !== undefined ? { sendScreenshots } : undefined,
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
        `🔐 Credentials found - will login before scraping`,
      );
      credentials = creds;
    } else {
      console.log(`ℹ️  No credentials found - will scrape without login`);
    }
  }

  const maxJobsToClick = config.browserUseMaxJobsToClick;

  // Choose prompt based on whether credentials are available
  let promptTemplate;
  let taskVariables;
  let startUrl;
  let maxTime;

  if (credentials) {
    // WITH CREDENTIALS: Use combined login + extraction prompt
    console.log(
      `\n🔐 Using combined login + extraction task (max ${maxJobsToClick} jobs)...`,
    );

    promptTemplate = await dbDirect.ai_chat_prompts.findUnique({
      where: { request: "browser_use_login_and_extract_jobs" },
    });

    if (!promptTemplate) {
      throw new Error(
        "Prompt template 'browser_use_login_and_extract_jobs' not found in ai_chat_prompts",
      );
    }

    taskVariables = {
      platformUrl: platform.url,
      platformName: platform.name,
      username: credentials.username,
      password: credentials.password,
      searchUrl,
      maxJobsToClick: maxJobsToClick.toString(),
    };

    startUrl = platform.url; // Start at platform URL for login
    maxTime = 120 + 60 + (maxJobsToClick * 30); // 2min login + 1min base + 30s per job
  } else {
    // WITHOUT CREDENTIALS: Use extraction-only prompt
    console.log(
      `\n📋 Using extraction-only task (max ${maxJobsToClick} jobs)...`,
    );

    promptTemplate = await dbDirect.ai_chat_prompts.findUnique({
      where: { request: "browser_use_extract_jobs_by_clicking" },
    });

    if (!promptTemplate) {
      throw new Error(
        "Prompt template 'browser_use_extract_jobs_by_clicking' not found in ai_chat_prompts",
      );
    }

    taskVariables = {
      searchUrl,
      maxJobsToClick: maxJobsToClick.toString(),
    };

    startUrl = searchUrl; // Start directly at search URL
    maxTime = 60 + (maxJobsToClick * 30); // 1min base + 30s per job
  }

  // Interpolate variables in the prompt
  const systemPrompt = promptTemplate.system_prompt || "";
  const userPrompt = interpolatePrompt(
    promptTemplate.user_prompt || "",
    taskVariables,
  );
  const task = `${systemPrompt}\n\n${userPrompt}`.trim();

  // Execute the browser-use task
  console.log(`🚀 Starting task (timeout: ${Math.max(180, maxTime)}s)...`);
  const response = await browserUse.executeTask({
    task,
    startUrl,
    maxTime: Math.max(180, maxTime), // At least 3 minutes
  });

  // Parse the JSON result with multiple fallback strategies
  let jobs: any[];
  try {
    jobs = parseBrowserUseResponse(response.result);

    // Debug: Save raw response to file for inspection
    try {
      const fs = await import("fs/promises");
      const debugFile = `/tmp/browser-use-response-${Date.now()}.json`;
      await fs.writeFile(
        debugFile,
        JSON.stringify(response, null, 2),
      );
      console.log(`🐛 Debug: Raw response saved to ${debugFile}`);
    } catch (writeError) {
      // Ignore file write errors
    }
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

  // Debug: Show summary of extracted jobs
  console.log("\n📋 Extracted jobs summary:");
  jobs.forEach((job, idx) => {
    console.log(
      `   ${idx + 1}. ${job.title || "[No title]"} - ${
        job.company || "[No company]"
      }`,
    );
    console.log(`      URL: ${job.application_url || "[No URL]"}`);
  });
  console.log("");

  // Apply filters and save
  let processedCount = 0;
  for (const jobData of jobs) {
    console.log(`\n📝 Processing: ${jobData.title || "[No title]"}`);
    console.log(`   Company: ${jobData.company || "[Not specified]"}`);
    console.log(`   URL: ${jobData.application_url || "[No URL]"}`);

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
