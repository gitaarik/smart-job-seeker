/**
 * Request Validation Schemas
 * Zod schemas for validating webhook payloads and API requests
 */

import { z } from "zod";

/**
 * Base webhook payload schema
 */
export const webhookPayloadSchema = z.object({
  event: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  keys: z.array(z.union([z.string(), z.number()])).optional(),
  key: z.union([z.string(), z.number()]).optional(),
  collection: z.string().optional(),
});

/**
 * Profile export webhook schema
 */
export const profileExportSchema = z.object({
  event: z.literal("profile.export"),
  payload: z.object({
    profileIds: z.array(z.number()).optional(),
  }).optional(),
  keys: z.array(z.number()).optional(),
});

/**
 * AI chat generation schemas
 */
export const aiChatGeneratePromptSchema = z.object({
  event: z.literal("ai_chats.generate_full_prompt"),
  payload: z.object({
    aiChatIds: z.array(z.union([z.string(), z.number()])).optional(),
  }).optional(),
});

export const aiChatGenerateResponseSchema = z.object({
  event: z.literal("ai_chats.generate_response"),
  payload: z.object({
    aiChatIds: z.array(z.union([z.string(), z.number()])).optional(),
  }).optional(),
});

/**
 * Application question schemas
 */
export const applicationQuestionGenerateSchema = z.object({
  event: z.literal("application_interview_question.generate_ai_answer"),
  payload: z.object({
    questionIds: z.array(z.union([z.string(), z.number()])).optional(),
  }).optional(),
  keys: z.array(z.union([z.string(), z.number()])).optional(),
});

export const applicationQuestionFollowupSchema = z.object({
  event: z.literal("application_questions.create_followup"),
  payload: z.object({
    followup_request: z.string().min(1),
    include_original_context: z.string().optional(),
  }).optional(),
  keys: z.array(z.number()).optional(),
});

/**
 * Application letter schemas
 */
export const applicationLetterGenerateSchema = z.object({
  event: z.literal("application_letter.generate"),
  payload: z.object({
    letterIds: z.array(z.union([z.string(), z.number()])).optional(),
  }).optional(),
  keys: z.array(z.union([z.string(), z.number()])).optional(),
});

export const applicationLetterFollowupSchema = z.object({
  event: z.literal("application_letter.create_followup"),
  payload: z.object({
    followup_request: z.string().min(1),
    include_original_context: z.string().optional(),
  }).optional(),
  keys: z.array(z.number()).optional(),
});

/**
 * Profile version schema
 */
export const profileVersionLinksSchema = z.object({
  event: z.literal("profile_version.generate_preview_links"),
  payload: z.object({
    versionIds: z.array(z.union([z.string(), z.number()])).optional(),
  }).optional(),
  keys: z.array(z.union([z.string(), z.number()])).optional(),
});

/**
 * Validate webhook payload
 */
export function validateWebhookPayload(
  data: unknown,
): z.infer<typeof webhookPayloadSchema> {
  return webhookPayloadSchema.parse(data);
}

/**
 * Validate specific webhook event
 */
export function validateEventPayload(
  eventType: string,
  data: unknown,
): unknown {
  const schemas: Record<string, z.ZodSchema> = {
    "profile.export": profileExportSchema,
    "ai_chats.generate_full_prompt": aiChatGeneratePromptSchema,
    "ai_chats.generate_response": aiChatGenerateResponseSchema,
    "application_interview_question.generate_ai_answer":
      applicationQuestionGenerateSchema,
    "application_questions.create_followup": applicationQuestionFollowupSchema,
    "application_letter.generate": applicationLetterGenerateSchema,
    "application_letter.create_followup": applicationLetterFollowupSchema,
    "profile_version.generate_preview_links": profileVersionLinksSchema,
  };

  const schema = schemas[eventType];
  if (!schema) {
    // No specific schema, just validate base payload
    return webhookPayloadSchema.parse(data);
  }

  return schema.parse(data);
}
