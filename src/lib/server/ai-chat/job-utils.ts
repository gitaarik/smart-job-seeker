/**
 * AI Chat utilities for job scraping operations
 *
 * Provides wrapper functions around createAndGenerateAiChat that are
 * specifically designed for job scraping and matching operations.
 */

import { createAndGenerateAiChat } from "./utils.js";
import { dbDirect } from "$lib/server/db";

/**
 * Result type for job scraping AI chat operations
 */
export interface JobScrapingAiChatResult<T> {
  success: boolean;
  message: string;
  response: T | null;
  aiChatId: number | null;
}

/**
 * Create AI chat for job scraping operations
 *
 * Looks up the profile from the search_tasks record. Automatically saves
 * prompts and responses to the database for debugging and audit purposes.
 *
 * @param searchTaskId - ID of the job search (used to lookup profile)
 * @param promptKey - Template identifier from ai_chat_templates table
 * @param customVariables - Variables to interpolate into the prompt template
 * @returns Result with parsed response and aiChatId for database linking
 *
 * @example
 * const result = await createJobScrapingAiChat<{ urls: string[] }>(
 *   searchTaskId,
 *   "extract_job_links",
 *   { html: strippedHtml }
 * );
 *
 * if (result.success && result.response) {
 *   const urls = result.response.urls;
 *   // Save aiChatId to job record for audit trail
 * }
 */
export async function createJobScrapingAiChat<T>(
  searchTaskId: number,
  promptKey: string,
  customVariables: Record<string, unknown>,
): Promise<JobScrapingAiChatResult<T>> {
  // Look up profile from search_tasks
  const searchTask = await dbDirect.search_tasks.findUnique({
    where: { id: searchTaskId },
    select: { profile_id: true },
  });

  if (!searchTask) {
    return {
      success: false,
      message: `Job search ${searchTaskId} not found`,
      response: null,
      aiChatId: null,
    };
  }

  if (!searchTask.profile_id) {
    return {
      success: false,
      message: `Job search ${searchTaskId} has no profile assigned`,
      response: null,
      aiChatId: null,
    };
  }

  try {
    // Call createAndGenerateAiChat with profile from search_tasks
    const result = await createAndGenerateAiChat(
      searchTask.profile_id,
      promptKey,
      customVariables,
    );

    if (!result.success || !result.aiChat) {
      return {
        success: false,
        message: result.message,
        response: null,
        aiChatId: null,
      };
    }

    // Parse JSON response
    let parsedResponse: T | null = null;
    if (result.aiChat.response) {
      try {
        parsedResponse = JSON.parse(result.aiChat.response) as T;
      } catch (_parseError) {
        return {
          success: false,
          message:
            `Failed to parse AI response as JSON (ai_chat ID: ${result.aiChat.id})`,
          response: null,
          aiChatId: result.aiChat.id,
        };
      }
    }

    return {
      success: true,
      message: result.message,
      response: parsedResponse,
      aiChatId: result.aiChat.id,
    };
  } catch (error) {
    return {
      success: false,
      message: `AI chat creation failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      response: null,
      aiChatId: null,
    };
  }
}

/**
 * Create AI chat for job matching operations
 *
 * Uses the actual user profile for job matching operations, allowing
 * personalized job recommendations based on the user's profile data.
 * Automatically saves prompts and responses for debugging.
 *
 * @param profileId - User's profile ID
 * @param promptKey - Template identifier from ai_chat_templates table
 * @param customVariables - Variables to interpolate (job data, preferences, etc.)
 * @returns Result with parsed response and aiChatId for database linking
 *
 * @example
 * const result = await createJobMatchingAiChat<MatchScoreType>(
 *   userProfileId,
 *   "score_job_match",
 *   {
 *     "preferences.job_types": JSON.stringify(preferences.job_types),
 *     jobDescription: job.job_description
 *   }
 * );
 *
 * if (result.success && result.response) {
 *   // Save match score and link aiChatId to job_matches record
 *   await db.job_matches.create({
 *     data: {
 *       score: result.response.score,
 *       ai_chat_scoring: result.aiChatId,
 *       // ... other fields
 *     }
 *   });
 * }
 */
export async function createJobMatchingAiChat<T>(
  profileId: number,
  promptKey: string,
  customVariables: Record<string, unknown>,
): Promise<JobScrapingAiChatResult<T>> {
  try {
    // Call createAndGenerateAiChat with user profile
    const result = await createAndGenerateAiChat(
      profileId,
      promptKey,
      customVariables,
    );

    if (!result.success || !result.aiChat) {
      return {
        success: false,
        message: result.message,
        response: null,
        aiChatId: null,
      };
    }

    // Parse JSON response
    let parsedResponse: T | null = null;
    if (result.aiChat.response) {
      try {
        parsedResponse = JSON.parse(result.aiChat.response) as T;
      } catch (_parseError) {
        return {
          success: false,
          message:
            `Failed to parse AI response as JSON (ai_chat ID: ${result.aiChat.id})`,
          response: null,
          aiChatId: result.aiChat.id,
        };
      }
    }

    return {
      success: true,
      message: result.message,
      response: parsedResponse,
      aiChatId: result.aiChat.id,
    };
  } catch (error) {
    return {
      success: false,
      message: `AI chat creation failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      response: null,
      aiChatId: null,
    };
  }
}
