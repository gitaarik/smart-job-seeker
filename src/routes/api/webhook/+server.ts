import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { getEnv } from "$lib/tools/get-env";
import type { WebhookPayload, WebhookResponse } from "$lib/types/webhook";
import { exportProfile } from "$lib/server/profile-export";
import { generateAiChatFullPrompt } from "$lib/server/ai-chat-full-prompt-generate";
import { generateAiChatResponse } from "$lib/server/ai-chat-response-generate";
import { generateApplicationQuestionAnswer } from "$lib/server/ai-chat-interview-question";
import { clearDirectusCache } from "$lib/server/directus";

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
