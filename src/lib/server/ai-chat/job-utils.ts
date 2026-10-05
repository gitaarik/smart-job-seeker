/**
 * AI Chat utilities for job scraping operations
 *
 * Provides wrapper functions around createAndGenerateAiChat that are
 * specifically designed for job scraping and matching operations.
 */

import { createAndGenerateAiChat, reserveAiChatId } from './utils.js';
import { db, dbDirect } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { ai_chats, profiles, search_tasks } from '$lib/server/db/schema';
import { tokensToCost } from '$lib/server/billing/credits';
import { estimateProviderCostUsd } from '$lib/server/billing/provider-costs';
import { systemOne } from '$lib/server/llm/typesafe';
import { recordedTraceId, traceGeneration } from '$lib/server/monitoring/telemetry';
import { loadProfileData, NON_SKILL_FIELDS, renderProfileData } from './profile-data';
import { promptFingerprint } from './prompt-fingerprint';
import { promptTemplates } from './prompt-templates.js';
import {
	matchedByProbability,
	SKILL_MATCH_MODEL,
	SKILL_MATCH_PROMPT,
	skillDecisionRequest,
	skillProbabilities
} from './skill-decisions';

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

/** The user a profile belongs to, as a trace's user. */
export async function profileOwnerId(profileId: number): Promise<string | undefined> {
	const profile = await dbDirect.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		columns: { user_id: true }
	});
	return profile?.user_id ?? undefined;
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
 * const result = await createJobScrapingAiChat<{ jobs: Array<{ title: string }> }>(
 *   searchTaskId,
 *   "extract_jobs_from_search_page",
 *   { html: strippedHtml }
 * );
 *
 * if (result.success && result.response) {
 *   const jobs = result.response.jobs;
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

/**
 * The matcher's skill pass on TypeSafe's Jev (skill-decisions.ts): which of
 * `skills` the profile shows.
 *
 * Recorded like a prompt call so cost tracking and the traces see it: an
 * `ai_chats` row under the prompt's key with provider `typesafe` and every
 * probability in its response, a generation in the open trace, and credits
 * charged by tokens as the prompt would have been charged.
 *
 * Throws on any failure, including a profile over Jev's size limit, so the
 * matcher can fall back to the prompt. A failed call keeps its error on the
 * row and is charged nothing.
 */
export async function decideMatchedSkills(
	profileId: number,
	skills: readonly string[]
): Promise<string[]> {
	const template = promptTemplates[SKILL_MATCH_PROMPT];
	const profile = await loadProfileData(profileId, undefined, { exclude: NON_SKILL_FIELDS });
	const request = skillDecisionRequest(renderProfileData(profile.data), skills);
	const aiChatId = await reserveAiChatId();
	await db.insert(ai_chats).values({
		id: aiChatId,
		profile_id: profileId,
		// The template, as every row stores it, so whatever reads rows by their
		// prompt finds this one where it found the prompt's.
		system_prompt: template.system_prompt,
		user_prompt: template.user_prompt,
		context: JSON.parse(JSON.stringify({ data: profile.data, 'job.skills': skills.join('\n') })),
		// What was actually sent, which here is a request rather than a prompt.
		full_prompt: JSON.stringify(request),
		prompt_key: SKILL_MATCH_PROMPT,
		prompt_fingerprint: promptFingerprint(template),
		date_created: new Date(),
		provider: 'typesafe',
		model: SKILL_MATCH_MODEL,
		request_type: 'llm',
		trace_id: recordedTraceId()
	});

	const costOf = (input: number, output: number) =>
		estimateProviderCostUsd('typesafe', SKILL_MATCH_MODEL, input, output);
	const started = performance.now();
	let probabilities: number[];
	let usage: { input_tokens: number; output_tokens: number };
	try {
		const response = await traceGeneration(
			SKILL_MATCH_PROMPT,
			{ skills },
			() => systemOne(request),
			(result) => ({
				model: SKILL_MATCH_MODEL,
				output: result.answers,
				usageDetails: { input: result.usage.input_tokens, output: result.usage.output_tokens },
				costDetails: {
					total: costOf(result.usage.input_tokens, result.usage.output_tokens) ?? 0
				}
			})
		);
		probabilities = skillProbabilities(response, skills);
		usage = response.usage;
	} catch (error) {
		await db
			.update(ai_chats)
			.set({
				error: error instanceof Error ? error.message : String(error),
				duration_ms: Math.round(performance.now() - started)
			})
			.where(eq(ai_chats.id, aiChatId));
		throw error;
	}

	const matched = matchedByProbability(skills, probabilities);
	const inputTokens = usage.input_tokens;
	const outputTokens = usage.output_tokens;
	const totalTokens = inputTokens + outputTokens;
	const credits = tokensToCost(totalTokens);
	await db
		.update(ai_chats)
		.set({
			response: JSON.stringify({
				matched_skills: matched,
				probabilities: Object.fromEntries(skills.map((skill, i) => [skill, probabilities[i]]))
			}),
			input_tokens: inputTokens,
			output_tokens: outputTokens,
			total_tokens: totalTokens,
			duration_ms: Math.round(performance.now() - started),
			credits_charged: credits || null
		})
		.where(eq(ai_chats.id, aiChatId));

	if (credits > 0) {
		const owner = await db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			columns: { user_id: true }
		});
		if (owner?.user_id) {
			const { chargeCredits } = await import('$lib/server/billing/credits');
			await chargeCredits(
				owner.user_id,
				credits,
				'ai_generation',
				`${SKILL_MATCH_PROMPT} (${totalTokens} tokens)`,
				{
					aiChatId,
					promptKey: SKILL_MATCH_PROMPT,
					tokens: { inputTokens, outputTokens, totalTokens },
					provider: 'typesafe',
					model: SKILL_MATCH_MODEL,
					providerCostUsd: costOf(inputTokens, outputTokens)
				}
			);
		}
	}
	return matched;
}
