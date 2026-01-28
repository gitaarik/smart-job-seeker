/**
 * Browser-Use phase execution functions
 */

import { config } from "$lib/server/config";
import type { BrowserUseClient } from "$lib/server/browser/use-client";
import type {
  LoginTaskResult,
  NavigateSearchResult,
  Platform,
  PlatformCredentials,
  PrepareSessionResult,
} from "../types";
import {
  parseLoginTaskResult,
  parseNavigateSearchResult,
  parsePrepareSessionResult,
} from "./parser";
import {
  buildLoginTaskPrompt,
  buildNavigateSearchPrompt,
  buildPrepareSessionPrompt,
} from "./prompts";
import {
  createBrowserUseAiChat,
  getProfileFromJobSearch,
} from "$lib/server/ai-chat/browser-use";

const CDP_PORT = config.cdpPort;

/**
 * Execute Phase A: Login using browser_use_login prompt.
 * Returns whether login succeeded and if intervention is needed.
 */
export async function executeLoginPhase(
  browserUse: BrowserUseClient,
  platform: Platform,
  credentials: PlatformCredentials,
  useVision: boolean,
  jobSearchId: number,
): Promise<LoginTaskResult | null> {
  const loginUrl = platform.login_page_url!;
  console.log(`\n📌 Phase A: Login to ${platform.name}...`);
  console.log(`   Login URL: ${loginUrl}`);

  const loginTask = await buildLoginTaskPrompt(loginUrl, credentials);
  console.log("   Running login task...");

  const result = await browserUse.executeTask({
    task: loginTask,
    cdpPort: CDP_PORT,
    useVision,
  });

  console.log(
    `   Task completed, agent output: ${
      result.agent_output?.substring(0, 200)
    }...`,
  );

  // Log to ai_chat
  const profileId = await getProfileFromJobSearch(jobSearchId);
  if (profileId) {
    await createBrowserUseAiChat({
      profileId,
      taskPrompt: loginTask,
      agentOutput: result.agent_output ?? null,
      error: result.error ?? null,
      isCloudMode: browserUse.isCloudMode,
    });
  }

  const parsed = parseLoginTaskResult(result.agent_output || "");
  if (parsed) {
    console.log(
      `   Result: logged_in=${parsed.logged_in}, captcha_needed=${parsed.captcha_needed}`,
    );
    console.log(`   Reason: ${parsed.reason}`);
  }

  return parsed;
}

/**
 * Execute Phase B: Navigate to search page using browser_use_navigate_search prompt.
 * Returns whether search page is ready.
 */
export async function executeNavigateSearchPhase(
  browserUse: BrowserUseClient,
  searchUrl: string,
  useVision: boolean,
  jobSearchId: number,
): Promise<NavigateSearchResult | null> {
  console.log(`\n📌 Phase B: Navigate to search page...`);
  console.log(`   Search URL: ${searchUrl}`);

  const navigateTask = await buildNavigateSearchPrompt(searchUrl);
  console.log("   Running navigate task...");

  const result = await browserUse.executeTask({
    task: navigateTask,
    cdpPort: CDP_PORT,
    useVision,
  });

  console.log(
    `   Task completed, agent output: ${
      result.agent_output?.substring(0, 200)
    }...`,
  );

  // Log to ai_chat
  const profileId = await getProfileFromJobSearch(jobSearchId);
  if (profileId) {
    await createBrowserUseAiChat({
      profileId,
      taskPrompt: navigateTask,
      agentOutput: result.agent_output ?? null,
      error: result.error ?? null,
      isCloudMode: browserUse.isCloudMode,
    });
  }

  const parsed = parseNavigateSearchResult(result.agent_output || "");
  if (parsed) {
    console.log(
      `   Result: ready=${parsed.ready}, captcha_needed=${parsed.captcha_needed}`,
    );
    console.log(`   Reason: ${parsed.reason}`);
  }

  return parsed;
}

/**
 * Execute merged flow using browser_use_prepare_session prompt.
 * Handles login detection, optional login, and navigation in one task.
 */
export async function executePrepareSessionPhase(
  browserUse: BrowserUseClient,
  startUrl: string,
  searchUrl: string,
  credentials: PlatformCredentials | null,
  useVision: boolean,
  jobSearchId: number,
): Promise<PrepareSessionResult | null> {
  console.log(`\n📌 Prepare Session: Login (if needed) and navigate...`);
  console.log(`   Start URL: ${startUrl}`);
  console.log(`   Search URL: ${searchUrl}`);

  const prepareTask = await buildPrepareSessionPrompt(
    startUrl,
    searchUrl,
    credentials,
  );
  console.log("   Running prepare session task...");

  const result = await browserUse.executeTask({
    task: prepareTask,
    cdpPort: CDP_PORT,
    useVision,
  });

  console.log(
    `   Task completed, agent output: ${
      result.agent_output?.substring(0, 200)
    }...`,
  );

  // Log to ai_chat
  const profileId = await getProfileFromJobSearch(jobSearchId);
  if (profileId) {
    await createBrowserUseAiChat({
      profileId,
      taskPrompt: prepareTask,
      agentOutput: result.agent_output ?? null,
      error: result.error ?? null,
      isCloudMode: browserUse.isCloudMode,
    });
  }

  const parsed = parsePrepareSessionResult(result.agent_output || "");
  if (parsed) {
    console.log(
      `   Result: ready=${parsed.ready}, logged_in=${parsed.logged_in}, captcha_needed=${parsed.captcha_needed}`,
    );
    console.log(`   Reason: ${parsed.reason}`);
  }

  return parsed;
}
