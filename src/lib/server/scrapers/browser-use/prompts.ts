/**
 * Build Browser-Use AI agent prompts from database templates
 */

import { dbDirect } from "$lib/db";
import { interpolatePrompt } from "$lib/server/ai-chat/utils";
import type { PlatformCredentials } from "../types";

/**
 * Build login task prompt (browser_use_login)
 */
export async function buildLoginTaskPrompt(
  loginUrl: string,
  credentials: PlatformCredentials,
): Promise<string> {
  const promptTemplate = await dbDirect.ai_chat_prompts.findUnique({
    where: { request: "browser_use_login" },
  });

  if (!promptTemplate?.user_prompt) {
    throw new Error("Prompt 'browser_use_login' not found in database");
  }

  return interpolatePrompt(promptTemplate.user_prompt, {
    loginUrl,
    username: credentials.username,
    password: credentials.password,
  });
}

/**
 * Build navigate search task prompt (browser_use_navigate_search)
 */
export async function buildNavigateSearchPrompt(
  searchUrl: string,
): Promise<string> {
  const promptTemplate = await dbDirect.ai_chat_prompts.findUnique({
    where: { request: "browser_use_navigate_search" },
  });

  if (!promptTemplate?.user_prompt) {
    throw new Error(
      "Prompt 'browser_use_navigate_search' not found in database",
    );
  }

  return interpolatePrompt(promptTemplate.user_prompt, {
    searchUrl,
  });
}

/**
 * Build prepare session task prompt (browser_use_prepare_session)
 */
export async function buildPrepareSessionPrompt(
  startUrl: string,
  searchUrl: string,
  credentials: PlatformCredentials | null,
): Promise<string> {
  const promptTemplate = await dbDirect.ai_chat_prompts.findUnique({
    where: { request: "browser_use_prepare_session" },
  });

  if (!promptTemplate?.user_prompt) {
    throw new Error(
      "Prompt 'browser_use_prepare_session' not found in database",
    );
  }

  return interpolatePrompt(promptTemplate.user_prompt, {
    startUrl,
    searchUrl,
    username: credentials?.username || "(no credentials)",
    password: credentials?.password || "",
  });
}
