import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import type { WebhookPayload } from "$lib/types/webhook";
import { getEnv } from "$lib/tools/get-env";
import { exportProfile } from "$lib/server/profile-export";
import { generateAiChatFullPrompt } from "$lib/server/ai-chat-full-prompt-generate";
import { generateAiChatResponse } from "$lib/server/ai-chat-response-generate";
import { generateApplicationQuestionAnswer } from "$lib/server/ai-chat-application-question";
import { generateApplicationLetter } from "$lib/server/ai-chat-application-letter";
import { createApplicationLetterFollowup } from "$lib/server/ai-chat-application-letter-followup";
import { createApplicationQuestionFollowup } from "$lib/server/ai-chat-application-question-followup";
import { createFollowupAiChat } from "$lib/server/ai-chat-create-followup";
import { clearDirectusCache } from "$lib/server/directus";
import { db } from "$lib/db";

/**
 * Webhook endpoint for Directus Flow integration
 * Receives POST requests from Directus Flow scripts with header-based secret verification
 */

export const POST: RequestHandler = async (event) => {
  try {
    // Get webhook secret from environment
    const webhookSecret = getEnv("WEBHOOK_SECRET", "");

    if (!webhookSecret) {
      return json(
        {
          success: false,
          message: "Webhook not configured",
          error: "WEBHOOK_SECRET environment variable is not set",
        },
        { status: 500 },
      );
    }

    // Get secret from request header
    const headerSecret = event.request.headers.get("x-webhook-secret");

    if (!headerSecret) {
      return json(
        {
          success: false,
          message: "Unauthorized",
          error: "Missing webhook secret header",
        },
        { status: 401 },
      );
    }

    // Verify secret matches
    if (headerSecret !== webhookSecret) {
      return json(
        {
          success: false,
          message: "Unauthorized",
          error: "Invalid webhook secret",
        },
        { status: 401 },
      );
    }

    // Parse the payload
    let payload: WebhookPayload;
    try {
      const body = await event.request.text();
      payload = JSON.parse(body) as WebhookPayload;
    } catch (parseError) {
      return json(
        {
          success: false,
          message: "Invalid JSON payload",
          error: "Failed to parse request body as JSON",
        },
        { status: 400 },
      );
    }

    // Validate required fields
    if (!payload.eventType || !payload.data) {
      return json(
        {
          success: false,
          message: "Invalid payload structure",
          error: "Missing required fields: eventType, data",
        },
        { status: 400 },
      );
    }

    // Process webhook based on event type
    const result = await processWebhookEvent(payload);

    // Clear Directus cache after successful webhook processing (skip in tests)
    if (!process.env.VITEST) {
      try {
        console.log("[Webhook] Clearing Directus cache...");
        await clearDirectusCache();
        console.log("[Webhook] Directus cache cleared successfully");
      } catch (cacheError) {
        const cacheErrorMessage = cacheError instanceof Error
          ? cacheError.message
          : "Unknown error";
        console.warn(
          `[Webhook] Failed to clear Directus cache: ${cacheErrorMessage}`,
        );
        // Don't fail the webhook response due to cache clearing failure
      }
    }

    return json(
      {
        success: true,
        message: "Webhook processed successfully",
        data: result,
      },
      { status: 200 },
    );
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";

    return json(
      {
        success: false,
        message: "Internal server error",
        error: errorMessage,
      },
      { status: 500 },
    );
  }
};

/**
 * Process webhook events based on their type
 * Extend this function to handle different event types from Directus
 */
async function processWebhookEvent(
  payload: WebhookPayload,
): Promise<Record<string, unknown>> {
  const { eventType, data } = payload;

  // Handle different event types
  switch (eventType) {
    case "profile.export":
      return await handleProfileExport(data);
    case "ai_chat.generate_full_prompt":
      return await handleAiChatGenerateFullPrompt(data);
    case "ai_chat.generate_response":
      return await handleAiChatGenerateResponse(data);
    case "application_interview_question.generate_ai_answer":
      return await handleApplicationInterviewQuestionGenerateAiAnswer(data);
    case "application_letter.generate":
      return await handleApplicationLetterGenerate(data);
    case "application_letter.create_followup":
      return await handleApplicationLetterCreateFollowup(data);
    case "application_questions.create_followup":
      return await handleApplicationQuestionsCreateFollowup(data);
    case "ai_chat.create_followup":
      return await handleAiChatCreateFollowup(data);
    case "profile_version.generate_preview_links":
      return await handleProfileVersionGeneratePreviewLinks(data);
    default:
      return {
        processed: true,
        message: "Event type not specifically handled but received",
      };
  }
}

/**
 * Handle profile.export events
 * Called to export profile schema and data to collected_data collection
 * Expected data format: { profileIds: number[] } or { profileId: number }
 */
async function handleProfileExport(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Support both profileIds (array) and profileId (single) for backwards compatibility
  let profileIds: number[] = [];

  if (Array.isArray(data.profileIds)) {
    profileIds = (data.profileIds as unknown[])
      .map((id) => {
        const parsed = parseInt(String(id), 10);
        return isNaN(parsed) ? null : parsed;
      })
      .filter((id): id is number => id !== null);
  } else if (typeof data.profileId === "number") {
    profileIds = [data.profileId];
  }

  if (profileIds.length === 0) {
    return {
      processed: false,
      error:
        "Missing or invalid profileIds in data (expected array of numbers or single profileId)",
    };
  }

  try {
    const results = await Promise.allSettled(
      profileIds.map((profileId) =>
        exportProfile(profileId)
          .then((result) => ({
            profileId,
            success: result.success,
            schemaExport: result.schemaResult,
            dataExport: result.dataResult,
          }))
          .catch((error) => ({
            profileId,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          }))
      ),
    );

    const successful = results.filter(
      (r) => r.status === "fulfilled" && (r.value as any).success !== false,
    );
    const failed = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && (r.value as any).success === false),
    );

    return {
      processed: successful.length > 0,
      profileCount: profileIds.length,
      successCount: successful.length,
      results: results.map((
        r,
      ) => (r.status === "fulfilled" ? r.value : r.reason)),
      ...(failed.length > 0 && { failureCount: failed.length }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    console.error(`[Webhook] profile.export failed:`, errorMessage);
    return {
      processed: false,
      profileCount: profileIds.length,
      error: errorMessage,
    };
  }
}

/**
 * Handle ai_chat.generate_full_prompt events
 * Called to generate and update the full_prompt field by combining system_prompt and user_prompt
 * Expected data format: { aiChatIds: string[] }
 */
async function handleAiChatGenerateFullPrompt(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Extract and parse aiChatIds (array of strings to be converted to numbers)
  let aiChatIds: number[] = [];

  if (Array.isArray(data.aiChatIds)) {
    aiChatIds = (data.aiChatIds as unknown[])
      .map((id) => {
        const parsed = parseInt(String(id), 10);
        return isNaN(parsed) ? null : parsed;
      })
      .filter((id): id is number => id !== null);
  }

  if (aiChatIds.length === 0) {
    return {
      processed: false,
      error:
        "Missing or invalid aiChatIds in data (expected array of numeric strings)",
    };
  }

  try {
    const results = await Promise.allSettled(
      aiChatIds.map((aiChatId) =>
        generateAiChatFullPrompt(aiChatId)
          .then((result) => ({
            aiChatId,
            success: result.success,
            message: result.message,
          }))
          .catch((error) => ({
            aiChatId,
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
          }))
      ),
    );

    const successful = results.filter(
      (r) => r.status === "fulfilled" && (r.value as any).success !== false,
    );
    const failed = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && (r.value as any).success === false),
    );

    return {
      processed: successful.length > 0,
      aiChatCount: aiChatIds.length,
      successCount: successful.length,
      results: results.map((
        r,
      ) => (r.status === "fulfilled" ? r.value : r.reason)),
      ...(failed.length > 0 && { failureCount: failed.length }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    console.error(
      `[Webhook] ai_chat.generate_full_prompt failed:`,
      errorMessage,
    );
    return {
      processed: false,
      aiChatCount: aiChatIds.length,
      error: errorMessage,
    };
  }
}

/**
 * Handle ai_chat.generate_response events
 * Called to generate AI responses using Groq API
 * Expected data format: { aiChatIds: string[] }
 */
async function handleAiChatGenerateResponse(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Extract and parse aiChatIds (array of strings to be converted to numbers)
  let aiChatIds: number[] = [];

  if (Array.isArray(data.aiChatIds)) {
    aiChatIds = (data.aiChatIds as unknown[])
      .map((id) => {
        const parsed = parseInt(String(id), 10);
        return isNaN(parsed) ? null : parsed;
      })
      .filter((id): id is number => id !== null);
  }

  if (aiChatIds.length === 0) {
    return {
      processed: false,
      error:
        "Missing or invalid aiChatIds in data (expected array of numeric strings)",
    };
  }

  try {
    const results = await Promise.allSettled(
      aiChatIds.map((aiChatId) =>
        generateAiChatResponse(aiChatId)
          .then((result) => ({
            aiChatId,
            success: result.success,
            message: result.message,
          }))
          .catch((error) => ({
            aiChatId,
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
          }))
      ),
    );

    const successful = results.filter(
      (r) => r.status === "fulfilled" && (r.value as any).success !== false,
    );
    const failed = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && (r.value as any).success === false),
    );

    return {
      processed: successful.length > 0,
      aiChatCount: aiChatIds.length,
      successCount: successful.length,
      results: results.map((
        r,
      ) => (r.status === "fulfilled" ? r.value : r.reason)),
      ...(failed.length > 0 && { failureCount: failed.length }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    console.error(
      `[Webhook] ai_chat.generate_response failed:`,
      errorMessage,
    );
    return {
      processed: false,
      aiChatCount: aiChatIds.length,
      error: errorMessage,
    };
  }
}

/**
 * Handle application_interview_question.generate_ai_answer events
 * Called to generate AI-assisted answers for application interview questions
 * Expected data format: { ids: number[] }
 */
async function handleApplicationInterviewQuestionGenerateAiAnswer(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Extract and parse question IDs (array of numbers)
  let questionIds: number[] = [];

  if (Array.isArray(data.ids)) {
    questionIds = (data.ids as unknown[])
      .map((id) => {
        const parsed = parseInt(String(id), 10);
        return isNaN(parsed) ? null : parsed;
      })
      .filter((id): id is number => id !== null);
  }

  if (questionIds.length === 0) {
    return {
      processed: false,
      error: "Missing or invalid ids in data (expected array of numbers)",
    };
  }

  try {
    const results = await Promise.allSettled(
      questionIds.map((questionId) =>
        generateApplicationQuestionAnswer(questionId)
          .then((result) => ({
            questionId,
            success: result.success,
            message: result.message,
          }))
          .catch((error) => ({
            questionId,
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
          }))
      ),
    );

    const successful = results.filter(
      (r) => r.status === "fulfilled" && (r.value as any).success !== false,
    );
    const failed = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && (r.value as any).success === false),
    );

    return {
      processed: successful.length > 0,
      questionCount: questionIds.length,
      successCount: successful.length,
      results: results.map((
        r,
      ) => (r.status === "fulfilled" ? r.value : r.reason)),
      ...(failed.length > 0 && { failureCount: failed.length }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    console.error(
      `[Webhook] application_interview_question.generate_ai_answer failed:`,
      errorMessage,
    );
    return {
      processed: false,
      questionCount: questionIds.length,
      error: errorMessage,
    };
  }
}

/**
 * Handle application_letter.generate events
 * Called to generate AI-assisted letters for application_letters
 * Expected data format: { letterIds: number[] }
 */
async function handleApplicationLetterGenerate(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let letterIds: number[] = [];

  if (Array.isArray(data.letterIds)) {
    letterIds = (data.letterIds as unknown[])
      .map((id) => {
        const parsed = parseInt(String(id), 10);
        return isNaN(parsed) ? null : parsed;
      })
      .filter((id): id is number => id !== null);
  }

  if (letterIds.length === 0) {
    return {
      processed: false,
      error: "Missing or invalid letterIds in data (expected array of numbers)",
    };
  }

  // Extract optional additional context from the data
  const additionalContext = typeof data.additionalContext === "string"
    ? data.additionalContext
    : undefined;

  try {
    const results = await Promise.allSettled(
      letterIds.map((letterId) =>
        generateApplicationLetter(letterId, additionalContext)
          .then((result) => ({
            letterId,
            success: result.success,
            message: result.message,
          }))
          .catch((error) => ({
            letterId,
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
          }))
      ),
    );

    const successful = results.filter(
      (r) => r.status === "fulfilled" && (r.value as any).success !== false,
    );
    const failed = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && (r.value as any).success === false),
    );

    return {
      processed: successful.length > 0,
      letterCount: letterIds.length,
      successCount: successful.length,
      results: results.map((
        r,
      ) => (r.status === "fulfilled" ? r.value : r.reason)),
      ...(failed.length > 0 && { failureCount: failed.length }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    console.error(
      `[Webhook] application_letter.generate failed:`,
      errorMessage,
    );
    return {
      processed: false,
      letterCount: letterIds.length,
      error: errorMessage,
    };
  }
}

/**
 * Handle application_letter.create_followup events
 * Called to create a follow-up AI chat for an application letter
 * Expected data format: { letterId: number, followup_request: string, include_original_context?: boolean }
 */
async function handleApplicationLetterCreateFollowup(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Extract and validate letterId
  const letterIdRaw = data.letterId;
  const letterId = typeof letterIdRaw === "number"
    ? letterIdRaw
    : (typeof letterIdRaw === "string" ? parseInt(letterIdRaw, 10) : NaN);

  if (isNaN(letterId)) {
    return {
      success: false,
      error: "Missing or invalid letterId in data (expected number)",
    };
  }

  // Extract follow-up request
  const followupRequest = typeof data.followup_request === "string"
    ? data.followup_request
    : "";

  if (!followupRequest.trim()) {
    return {
      success: false,
      error: "Missing or empty followup_request in data",
    };
  }

  // Extract optional include_original_context
  const includeOriginalContext = data.include_original_context === "true" ||
    data.include_original_context === true;

  try {
    const result = await createApplicationLetterFollowup(
      letterId,
      followupRequest,
      includeOriginalContext,
    );

    return {
      success: result.success,
      message: result.message,
      data: result.aiChat
        ? {
          aiChatId: result.aiChat.id,
          letterId: letterId,
        }
        : undefined,
      ...(result.success ? {} : { error: result.message }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    console.error(
      `[Webhook] application_letter.create_followup failed:`,
      errorMessage,
    );
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Handle application_questions.create_followup events
 * Called to create a follow-up AI chat for an application question
 * Expected data format: { questionId: number, followup_request: string, include_original_context?: boolean }
 */
async function handleApplicationQuestionsCreateFollowup(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Extract and validate questionId
  const questionIdRaw = data.questionId;
  const questionId = typeof questionIdRaw === "number"
    ? questionIdRaw
    : (typeof questionIdRaw === "string" ? parseInt(questionIdRaw, 10) : NaN);

  if (isNaN(questionId)) {
    return {
      success: false,
      error: "Missing or invalid questionId in data (expected number)",
    };
  }

  // Extract follow-up request
  const followupRequest = typeof data.followup_request === "string"
    ? data.followup_request
    : "";

  if (!followupRequest.trim()) {
    return {
      success: false,
      error: "Missing or empty followup_request in data",
    };
  }

  // Extract optional include_original_context
  const includeOriginalContext = data.include_original_context === "true" ||
    data.include_original_context === true;

  try {
    const result = await createApplicationQuestionFollowup(
      questionId,
      followupRequest,
      includeOriginalContext,
    );

    return {
      success: result.success,
      message: result.message,
      data: result.aiChat
        ? {
          aiChatId: result.aiChat.id,
          questionId: questionId,
        }
        : undefined,
      ...(result.success ? {} : { error: result.message }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    console.error(
      `[Webhook] application_questions.create_followup failed:`,
      errorMessage,
    );
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Handle profile_version.generate_preview_links events
 * Called to generate preview link HTML for profile versions
 * Expected data format: { profileVersionIds: number[] }
 */
async function handleProfileVersionGeneratePreviewLinks(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let profileVersionIds: number[] = [];

  if (Array.isArray(data.profileVersionIds)) {
    profileVersionIds = (data.profileVersionIds as unknown[])
      .map((id) => {
        const parsed = parseInt(String(id), 10);
        return isNaN(parsed) ? null : parsed;
      })
      .filter((id): id is number => id !== null);
  }

  if (profileVersionIds.length === 0) {
    return {
      processed: false,
      error:
        "Missing or invalid profileVersionIds in data (expected array of numbers)",
    };
  }

  try {
    const results = await Promise.allSettled(
      profileVersionIds.map(async (profileVersionId) => {
        // Fetch the profile version to get its name
        const profileVersion = await db.profile_versions.findUnique({
          where: { id: profileVersionId },
          select: { name: true },
        });

        if (!profileVersion || !profileVersion.name) {
          throw new Error(
            `Profile version ${profileVersionId} not found or has no name`,
          );
        }

        const versionName = encodeURIComponent(profileVersion.name);
        const previewHtml =
          `<div style="display: flex; gap: 32px; font-size: 16px;">` +
          `<div style="display: flex; flex-direction: column; gap: 8px;">` +
          `<div style="font-weight: 600; margin-bottom: 10px;">📄 Resume</div>` +
          `<div style="display: flex; gap: 12px;">` +
          `<a href="http://localhost:5173/resume?version=${versionName}" target="_blank">HTML</a>` +
          `<a href="http://localhost:5173/resume.pdf?version=${versionName}" target="_blank">PDF</a>` +
          `</div>` +
          `</div>` +
          `<div style="display: flex; flex-direction: column; gap: 8px;">` +
          `<div style="font-weight: 600; margin-bottom: 10px;">📋 CV</div>` +
          `<div style="display: flex; gap: 12px;">` +
          `<a href="http://localhost:5173/cv?version=${versionName}" target="_blank">HTML</a>` +
          `<a href="http://localhost:5173/cv.pdf?version=${versionName}" target="_blank">PDF</a>` +
          `</div>` +
          `</div>` +
          `</div>`;

        await db.profile_versions.update({
          where: { id: profileVersionId },
          data: { preview_links: previewHtml },
        });

        return {
          profileVersionId,
          success: true,
          message: "Preview links generated successfully",
        };
      }),
    );

    const successful = results.filter(
      (r) => r.status === "fulfilled" && (r.value as any).success !== false,
    );
    const failed = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && (r.value as any).success === false),
    );

    return {
      processed: successful.length > 0,
      profileVersionCount: profileVersionIds.length,
      successCount: successful.length,
      results: results.map((
        r,
      ) => (r.status === "fulfilled" ? r.value : r.reason)),
      ...(failed.length > 0 && { failureCount: failed.length }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    console.error(
      `[Webhook] profile_version.generate_preview_links failed:`,
      errorMessage,
    );
    return {
      processed: false,
      profileVersionCount: profileVersionIds.length,
      error: errorMessage,
    };
  }
}

/**
 * Handle ai_chat.create_followup events
 * Called to create follow-up ai_chat instances for iterative refinement
 * Expected data format: {
 *   keys: number[],
 *   followup_request: string,
 *   include_original_context?: string
 * }
 */
async function handleAiChatCreateFollowup(
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Extract parent ai_chat IDs (called "keys" to match Directus convention)
  let parentAiChatIds: number[] = [];

  if (Array.isArray(data.keys)) {
    parentAiChatIds = (data.keys as unknown[])
      .map((id) => {
        const parsed = parseInt(String(id), 10);
        return isNaN(parsed) ? null : parsed;
      })
      .filter((id): id is number => id !== null);
  }

  if (parentAiChatIds.length === 0) {
    return {
      processed: false,
      error: "Missing or invalid keys in data (expected array of ai_chat IDs)",
    };
  }

  // Validate followup_request
  const followupRequest = data.followup_request;
  if (typeof followupRequest !== "string" || !followupRequest.trim()) {
    return {
      processed: false,
      error:
        "Missing or invalid followup_request in data (expected non-empty string)",
    };
  }

  // Get includeOriginalContext option (default: false)
  const includeOriginalContext = data.include_original_context === "true";

  try {
    const results = await Promise.allSettled(
      parentAiChatIds.map((parentAiChatId) =>
        createFollowupAiChat(parentAiChatId, followupRequest, {
          includeOriginalContext,
        })
          .then((result) => ({
            parentAiChatId,
            success: result.success,
            message: result.message,
            newAiChatId: result.aiChat?.id,
          }))
          .catch((error) => ({
            parentAiChatId,
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
          }))
      ),
    );

    const successful = results.filter(
      (r) => r.status === "fulfilled" && (r.value as any).success !== false,
    );
    const failed = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && (r.value as any).success === false),
    );

    return {
      processed: successful.length > 0,
      parentAiChatCount: parentAiChatIds.length,
      successCount: successful.length,
      results: results.map((
        r,
      ) => (r.status === "fulfilled" ? r.value : r.reason)),
      ...(failed.length > 0 && { failureCount: failed.length }),
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    console.error(
      `[Webhook] ai_chat.create_followup failed:`,
      errorMessage,
    );
    return {
      processed: false,
      parentAiChatCount: parentAiChatIds.length,
      error: errorMessage,
    };
  }
}
