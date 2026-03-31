/**
 * Generic entity followup creator for application letters and questions.
 * Both follow the same pattern: fetch entity → validate ai_chat → create followup → update entity.
 */

import { getErrorMessage } from "$lib/server/utils/errors";
import { createFollowupAiChat } from "./create-followup";

export type FollowupResult = {
  success: boolean;
  message: string;
  aiChat?: {
    id: number;
    profile: number;
    system_prompt: string;
    user_prompt: string;
    full_prompt: string | null;
    response: string | null;
    date_created: Date | null;
    date_updated: Date | null;
  };
};

/**
 * Create a follow-up AI chat for any entity that has an ai_chat reference.
 */
export async function createEntityFollowup(opts: {
  entityId: number;
  entityLabel: string;
  noAiChatHint?: string;
  followupRequest: string;
  includeOriginalContext?: boolean;
  promptType?: string;
  fetchEntity: (id: number) => Promise<{ id: number; ai_chat: number | null } | null>;
  updateEntity: (id: number, aiChatId: number, aiChatResponse: string | null) => Promise<void>;
}): Promise<FollowupResult> {
  const { entityId, entityLabel, followupRequest, includeOriginalContext, promptType, fetchEntity, updateEntity } = opts;
  const noAiChatHint = opts.noAiChatHint ?? "Generate the initial content first.";
  const capLabel = entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1);

  let entity;
  try {
    entity = await fetchEntity(entityId);
  } catch (error) {
    return {
      success: false,
      message: `Error creating ${entityLabel} follow-up: ${getErrorMessage(error)}`,
    };
  }

  if (!entity) {
    return {
      success: false,
      message: `${capLabel} with ID ${entityId} not found`,
    };
  }

  if (!entity.ai_chat) {
    return {
      success: false,
      message: `${capLabel} ${entityId} does not have an ai_chats yet. ${noAiChatHint}`,
    };
  }

  let result;
  try {
    result = await createFollowupAiChat(
      entity.ai_chat,
      followupRequest,
      { includeOriginalContext, promptType },
    );
  } catch (error) {
    return {
      success: false,
      message: `Error creating followup: ${getErrorMessage(error)}`,
    };
  }

  if (!result.success || !result.aiChat) {
    return result;
  }

  try {
    await updateEntity(entityId, result.aiChat.id, result.aiChat.response);
  } catch (error) {
    return {
      success: false,
      message: `Error updating ${entityLabel} record: ${getErrorMessage(error)}`,
    };
  }

  return {
    success: true,
    message: `Follow-up AI chat created successfully (ID: ${result.aiChat.id}). ${capLabel} ${entityId} has been updated.`,
    aiChat: result.aiChat,
  };
}
