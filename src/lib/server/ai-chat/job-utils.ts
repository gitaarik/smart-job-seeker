/**
 * AI Chat utilities for job scraping operations
 *
 * Provides wrapper functions around createAndGenerateAiChat that are
 * specifically designed for job scraping and matching operations.
 */

import { createAndGenerateAiChat } from './utils.js';
import { dbDirect } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { search_tasks } from '$lib/server/db/schema';

/**
 * The options bag `createAndGenerateAiChat` accepts, derived rather than
 * restated so this cannot drift from the thing it forwards to.
 */
export type AiChatOptions = NonNullable<Parameters<typeof createAndGenerateAiChat>[4]>;

/**
 * Result type for job scraping AI chat operations
 */
export interface JobScrapingAiChatResult<T> {
	success: boolean;
	message: string;
	response: T | null;
	aiChatId: number | null;
	/**
	 * The error this call died of, when it died of one.
	 *
	 * `message` is prose: it is built for a log line, and by the time a caller
	 * reads it the typed `LLMRateLimitError` / `LLMQuotaExceededError` /
	 * `LLMAuthenticationError` that produced it has been flattened into a
	 * sentence. Callers that need to *act* on the cause were left matching
	 * substrings of that sentence, which is how a Groq key problem could be
	 * classified as a platform login failure: the enhanced auth message
	 * contains the words "Authentication failed".
	 *
	 * Set only on the throwing path — a `{ success: false }` returned by
	 * `createAndGenerateAiChat` itself carries no error object, so this stays
	 * undefined and the caller is right back to the message. That is a real
	 * limit of this field, not an oversight.
	 */
	cause?: unknown;
}

/**
 * Look up the profile associated with a job search.
 *
 * @param searchTaskId - ID of the job search
 * @returns The profile ID, or null if the search or its profile is missing
 */
export async function getProfileIdForSearchTask(searchTaskId: number): Promise<number | null> {
	const searchTask = await dbDirect.query.search_tasks.findFirst({
		where: eq(search_tasks.id, searchTaskId),
		columns: { profile_id: true }
	});
	return searchTask?.profile_id ?? null;
}

/**
 * Run a prompt against a profile and return the parsed JSON response.
 *
 * Shared core behind {@link createJobScrapingAiChat} and
 * {@link createJobMatchingAiChat}. Automatically saves prompts and responses
 * to the database for debugging and audit purposes.
 *
 * @param profileId - Profile whose `collected_data` seeds the prompt
 * @param promptKey - Key into `promptTemplates` in prompt-templates.ts
 * @param customVariables - Variables to interpolate into the prompt template
 * @param options - Passed through to {@link createAndGenerateAiChat}; the
 *   matcher uses `profileDataExclude` to narrow the blob per prompt
 * @returns Result with parsed response and aiChatId for database linking
 */
export async function runProfileAiChat<T>(
	profileId: number,
	promptKey: string,
	customVariables: Record<string, unknown>,
	options?: AiChatOptions
): Promise<JobScrapingAiChatResult<T>> {
	try {
		const result = await createAndGenerateAiChat(
			profileId,
			promptKey,
			customVariables,
			undefined,
			options
		);

		if (!result.success || !result.aiChat) {
			return {
				success: false,
				message: result.message,
				response: null,
				aiChatId: null
			};
		}

		// Parse JSON response
		let parsedResponse: T | null = null;
		if (result.aiChat.response) {
			try {
				parsedResponse = JSON.parse(result.aiChat.response) as T;
			} catch {
				return {
					success: false,
					message: `Failed to parse AI response as JSON (ai_chat ID: ${result.aiChat.id})`,
					response: null,
					aiChatId: result.aiChat.id
				};
			}
		}

		return {
			success: true,
			message: result.message,
			response: parsedResponse,
			aiChatId: result.aiChat.id
		};
	} catch (error) {
		return {
			success: false,
			message: `AI chat creation failed: ${error instanceof Error ? error.message : String(error)}`,
			response: null,
			aiChatId: null,
			cause: error
		};
	}
}

/**
 * Create AI chat for job scraping operations
 *
 * Looks up the profile from the search_tasks record, then runs the prompt.
 *
 * @param searchTaskId - ID of the job search (used to lookup profile)
 * @param promptKey - Key into `promptTemplates` in prompt-templates.ts
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
	customVariables: Record<string, unknown>
): Promise<JobScrapingAiChatResult<T>> {
	const profileId = await getProfileIdForSearchTask(searchTaskId);
	if (profileId === null) {
		return {
			success: false,
			message: `Job search ${searchTaskId} not found or has no profile assigned`,
			response: null,
			aiChatId: null
		};
	}
	return runProfileAiChat<T>(profileId, promptKey, customVariables);
}

/**
 * Create AI chat for job matching operations
 *
 * Uses the actual user profile for job matching operations, allowing
 * personalized job recommendations based on the user's profile data.
 * Automatically saves prompts and responses for debugging.
 *
 * @param profileId - User's profile ID
 * @param promptKey - Key into `promptTemplates` in prompt-templates.ts
 * @param customVariables - Variables to interpolate (job data, preferences, etc.)
 * @param options - Passed through to {@link createAndGenerateAiChat}
 * @returns Result with parsed response and aiChatId for database linking
 */
export async function createJobMatchingAiChat<T>(
	profileId: number,
	promptKey: string,
	customVariables: Record<string, unknown>,
	options?: AiChatOptions
): Promise<JobScrapingAiChatResult<T>> {
	return runProfileAiChat<T>(profileId, promptKey, customVariables, options);
}
