/**
 * AI Chat utilities for Browser-Use operations
 *
 * Provides functions to log Browser-Use task executions to the ai_chat table
 * for audit, debugging, and tracking purposes.
 */

import { dbDirect } from "$lib/db";

interface BrowserUseAiChatParams {
  profileId: number;
  taskPrompt: string; // The task sent to browser-use
  agentOutput: string | null; // The agent_output from the result
  error?: string | null; // Error message if failed
  isCloudMode: boolean; // Whether running in cloud mode
}

/**
 * Create an ai_chat record for a Browser-Use task execution
 */
export async function createBrowserUseAiChat(
  params: BrowserUseAiChatParams,
): Promise<{ aiChatId: number }> {
  const aiChat = await dbDirect.ai_chat.create({
    data: {
      profile: params.profileId,
      system_prompt: params.taskPrompt,
      user_prompt: "", // Browser-Use uses single task string
      response: params.agentOutput,
      error: params.error,
      date_created: new Date(),
      provider: "browser-use",
      model: params.isCloudMode ? "cloud" : "local",
      request_type: "browser-use",
    },
  });

  return { aiChatId: aiChat.id };
}

/**
 * Look up profile ID from a job search
 */
export async function getProfileFromJobSearch(
  jobSearchId: number,
): Promise<number | null> {
  const jobSearch = await dbDirect.job_searches.findUnique({
    where: { id: jobSearchId },
    select: { profile: true },
  });
  return jobSearch?.profile ?? null;
}
