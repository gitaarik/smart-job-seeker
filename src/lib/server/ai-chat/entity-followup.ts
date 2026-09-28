/**
 * Generic entity followup creator for application letters and questions.
 * Both follow the same pattern: fetch entity → validate ai_chat → create followup → update entity.
 */

import { getErrorMessage } from '$lib/server/utils/errors';
import type { ChatMessage } from '$lib/server/llm';
import type { GenerationContextOption } from './generation-context';
import type { ExportedProfileKey } from '$lib/server/profile/export';
import { createFollowupAiChat } from './create-followup';

/**
 * What kind of turn a followup is. Two are steps the editor runs from a button
 * rather than messages the applicant typed: `review` asks for a critique, and
 * `apply_advice` asks for a version written from the suggestions in the turn
 * above ("Write a version from this advice"). Their request is the editor's
 * wording, so neither is recorded as the applicant's message; the replay
 * narrates them instead (see conversation-messages.ts).
 */
export type FollowupMode = 'feedback' | 'review' | 'apply_advice';

/**
 * The message to record on a followup turn: what the applicant typed, or
 * nothing when the editor supplied the request. Recording the editor's wording
 * put a message the applicant never wrote in their "Your feedback" bubble,
 * editable and resendable as if it were theirs.
 */
export function applicantMessage(followupRequest: string, mode?: FollowupMode): string | undefined {
	return mode === 'review' || mode === 'apply_advice' ? undefined : followupRequest;
}

/**
 * Thrown from `updateEntity` when a step came back with nothing to record. A
 * typed message is kept as a turn of its own so it can be resent; a step has
 * no message to keep, and a row holding nothing would be an empty turn in the
 * thread. Its message reaches the applicant as it is.
 */
export class EmptyStepError extends Error {
	constructor() {
		super('The AI came back with nothing to show. Please try again.');
	}
}

export type FollowupResult = {
	success: boolean;
	message: string;
	aiChat?: {
		id: number;
		profile_id: number;
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
	/** The entity's table, singular, which names the trace's session: `cheat_sheet:3`. */
	entityKind: string;
	noAiChatHint?: string;
	followupRequest: string;
	includeOriginalContext?: boolean;
	promptType?: string;
	customVariables?: Record<string, unknown>;
	profileDataFields?: ExportedProfileKey[];
	/** Evidence to assemble for this turn — see generation-context.ts. */
	context?: GenerationContextOption;
	/** Prior turns of this thread, replayed as real messages. */
	historyMessages?: ChatMessage[];
	fetchEntity: (id: number) => Promise<{ id: number; ai_chat_id: number | null } | null>;
	updateEntity: (id: number, aiChatId: number, aiChatResponse: string | null) => Promise<void>;
}): Promise<FollowupResult> {
	const {
		entityId,
		entityLabel,
		followupRequest,
		includeOriginalContext,
		promptType,
		customVariables,
		fetchEntity,
		updateEntity
	} = opts;
	const noAiChatHint = opts.noAiChatHint ?? 'Generate the initial content first.';
	const capLabel = entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1);

	let entity;
	try {
		entity = await fetchEntity(entityId);
	} catch (error) {
		return {
			success: false,
			message: `Error creating ${entityLabel} follow-up: ${getErrorMessage(error)}`
		};
	}

	if (!entity) {
		return {
			success: false,
			message: `${capLabel} with ID ${entityId} not found`
		};
	}

	if (!entity.ai_chat_id) {
		return {
			success: false,
			message: `${capLabel} ${entityId} does not have an ai_chats yet. ${noAiChatHint}`
		};
	}

	let result;
	try {
		result = await createFollowupAiChat(entity.ai_chat_id, followupRequest, {
			includeOriginalContext,
			promptType,
			customVariables,
			profileDataFields: opts.profileDataFields,
			context: opts.context,
			historyMessages: opts.historyMessages,
			traceSession: `${opts.entityKind}:${entityId}`
		});
	} catch (error) {
		return {
			success: false,
			message: `Error creating followup: ${getErrorMessage(error)}`
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
			message:
				error instanceof EmptyStepError
					? error.message
					: `Error updating ${entityLabel} record: ${getErrorMessage(error)}`
		};
	}

	return {
		success: true,
		message: `Follow-up AI chat created successfully (ID: ${result.aiChat.id}). ${capLabel} ${entityId} has been updated.`,
		aiChat: result.aiChat
	};
}
