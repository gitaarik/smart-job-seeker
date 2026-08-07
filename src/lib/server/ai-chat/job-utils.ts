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
 * Result type for job scraping AI chat operations
 */
export interface JobScrapingAiChatResult<T> {
	success: boolean;
	message: string;
	response: T | null;
	aiChatId: number | null;
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
 * @param promptKey - Template identifier from ai_chat_templates table
 * @param customVariables - Variables to interpolate into the prompt template
 * @returns Result with parsed response and aiChatId for database linking
 */
export async function runProfileAiChat<T>(
	profileId: number,
	promptKey: string,
	customVariables: Record<string, unknown>
): Promise<JobScrapingAiChatResult<T>> {
	try {
		const result = await createAndGenerateAiChat(profileId, promptKey, customVariables);

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
			} catch (_parseError) {
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
			aiChatId: null
		};
	}
}

/**
 * Create AI chat for job scraping operations
 *
 * Looks up the profile from the search_tasks record, then runs the prompt.
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
 * @param promptKey - Template identifier from ai_chat_templates table
 * @param customVariables - Variables to interpolate (job data, preferences, etc.)
 * @returns Result with parsed response and aiChatId for database linking
 */
export async function createJobMatchingAiChat<T>(
	profileId: number,
	promptKey: string,
	customVariables: Record<string, unknown>
): Promise<JobScrapingAiChatResult<T>> {
	return runProfileAiChat<T>(profileId, promptKey, customVariables);
}
