/**
 * AI Chat utilities for job scraping operations
 *
 * Provides wrapper functions around createAndGenerateAiChat that are
 * specifically designed for job scraping and matching operations.
 */

import { config } from "$lib/server/config";
import { createAndGenerateAiChat } from "./utils";
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
 * Looks up the profile from the job_searches record. Automatically saves
 * prompts and responses to the database for debugging and audit purposes.
 *
 * @param jobSearchId - ID of the job search (used to lookup profile)
 * @param promptKey - Template identifier from ai_chat_templates table
 * @param customVariables - Variables to interpolate into the prompt template
 * @returns Result with parsed response and aiChatId for database linking
 *
 * @example
 * const result = await createJobScrapingAiChat<{ urls: string[] }>(
 *   jobSearchId,
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
  jobSearchId: number,
  promptKey: string,
  customVariables: Record<string, unknown>,
): Promise<JobScrapingAiChatResult<T>> {
  // Look up profile from job_searches
  const jobSearch = await dbDirect.job_searches.findUnique({
    where: { id: jobSearchId },
    select: { profile: true },
  });

  if (!jobSearch) {
    return {
      success: false,
      message: `Job search ${jobSearchId} not found`,
      response: null,
      aiChatId: null,
    };
  }

  if (!jobSearch.profile) {
    return {
      success: false,
      message: `Job search ${jobSearchId} has no profile assigned`,
      response: null,
      aiChatId: null,
    };
  }

  try {
    // Call createAndGenerateAiChat with profile from job_searches
    const result = await createAndGenerateAiChat(
      jobSearch.profile,
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
        const viewUrl =
          `${config.directusUrl}/admin/content/ai_chats/${result.aiChat.id}`;
        return {
          success: false,
          message:
            `Failed to parse AI response as JSON. View response: ${viewUrl}`,
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
        const viewUrl =
          `${config.directusUrl}/admin/content/ai_chats/${result.aiChat.id}`;
        return {
          success: false,
          message:
            `Failed to parse AI response as JSON. View response: ${viewUrl}`,
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
