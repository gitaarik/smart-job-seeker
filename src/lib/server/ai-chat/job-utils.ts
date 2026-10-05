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
import {
	isOversize,
	systemOne,
	type SystemOneRequest,
	type SystemOneResponse
} from '$lib/server/llm/typesafe';
import { recordedTraceId, traceGeneration } from '$lib/server/monitoring/telemetry';
import {
	MATCH_PROFILE_LEAVES_OUT,
	MATCH_SCORE_MODEL,
	MATCH_SCORE_PROMPT,
	matchDecisionFingerprint,
	matchDecisionRequest,
	matchScoreFrom,
	type ScoreFactors
} from './match-decisions';
import {
	loadProfileData,
	NON_FIT_FIELDS,
	NON_SKILL_FIELDS,
	renderProfileData
} from './profile-data';
import { promptTemplates } from './prompt-templates.js';
import { promptValues } from './render-prompt';
import {
	matchedByProbability,
	SKILL_MATCH_MODEL,
	SKILL_MATCH_PROMPT,
	skillDecisionFingerprint,
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
 * One System One call, recorded the way a prompt call is: an `ai_chats` row
 * under the prompt's key with provider `typesafe` and the decision in its
 * response, a generation in the open trace, and credits charged by tokens as the
 * prompt would have been charged.
 *
 * `requests` are tried in order, the next one only when the one before was over
 * the model's size limit (isOversize), so a caller can offer a smaller state.
 * `read` turns the answer into the caller's value and what the row records, and
 * throws when the answer is incomplete.
 *
 * Throws on any failure, a state still over the limit included, so the caller
 * can fall back to the prompt. A failed call keeps its error on the row and is
 * charged nothing.
 */
async function recordDecision<T>(decision: {
	profileId: number;
	promptKey: string;
	model: string;
	/** Which version of the decision this is, stored as the row's prompt_fingerprint. */
	fingerprint: string;
	/** The inputs, as the row's `context`. */
	context: Record<string, unknown>;
	requests: SystemOneRequest[];
	/** What the trace shows as the generation's input. */
	traceInput: unknown;
	read: (response: SystemOneResponse) => { value: T; recorded: unknown };
}): Promise<{ value: T; aiChatId: number }> {
	const { profileId, promptKey, model, requests } = decision;
	const template = promptTemplates[promptKey];
	const aiChatId = await reserveAiChatId();
	await db.insert(ai_chats).values({
		id: aiChatId,
		profile_id: profileId,
		// The template, as every row stores it, so whatever reads rows by their
		// prompt finds this one where it found the prompt's.
		system_prompt: template.system_prompt,
		user_prompt: template.user_prompt,
		context: JSON.parse(JSON.stringify(decision.context)),
		// What was actually sent, which here is a request rather than a prompt.
		full_prompt: JSON.stringify(requests[0]),
		prompt_key: promptKey,
		prompt_fingerprint: decision.fingerprint,
		date_created: new Date(),
		provider: 'typesafe',
		model,
		request_type: 'llm',
		trace_id: recordedTraceId()
	});

	const costOf = (input: number, output: number) =>
		estimateProviderCostUsd('typesafe', model, input, output);
	const started = performance.now();
	let answered = 0;
	let response: SystemOneResponse;
	let read: { value: T; recorded: unknown };
	try {
		for (;;) {
			try {
				response = await traceGeneration(
					promptKey,
					decision.traceInput,
					() => systemOne(requests[answered]),
					(result) => ({
						model,
						output: result.answers,
						usageDetails: { input: result.usage.input_tokens, output: result.usage.output_tokens },
						costDetails: {
							total: costOf(result.usage.input_tokens, result.usage.output_tokens) ?? 0
						}
					})
				);
				break;
			} catch (error) {
				if (!isOversize(error) || answered + 1 >= requests.length) throw error;
				answered++;
			}
		}
		read = decision.read(response);
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

	const inputTokens = response.usage.input_tokens;
	const outputTokens = response.usage.output_tokens;
	const totalTokens = inputTokens + outputTokens;
	const credits = tokensToCost(totalTokens);
	await db
		.update(ai_chats)
		.set({
			...(answered > 0 ? { full_prompt: JSON.stringify(requests[answered]) } : {}),
			response: JSON.stringify(read.recorded),
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
				`${promptKey} (${totalTokens} tokens)`,
				{
					aiChatId,
					promptKey,
					tokens: { inputTokens, outputTokens, totalTokens },
					provider: 'typesafe',
					model,
					providerCostUsd: costOf(inputTokens, outputTokens)
				}
			);
		}
	}
	return { value: read.value, aiChatId };
}

/**
 * The matcher's skill pass on TypeSafe's Jev (skill-decisions.ts): which of
 * `skills` the profile shows. Recorded by recordDecision, and throws as it
 * does, a profile over Jev's size limit included, so the matcher can fall back
 * to the prompt.
 */
export async function decideMatchedSkills(
	profileId: number,
	skills: readonly string[]
): Promise<string[]> {
	const profile = await loadProfileData(profileId, undefined, { exclude: NON_SKILL_FIELDS });
	const { value } = await recordDecision({
		profileId,
		promptKey: SKILL_MATCH_PROMPT,
		model: SKILL_MATCH_MODEL,
		fingerprint: skillDecisionFingerprint(),
		context: { data: profile.data, 'job.skills': skills.join('\n') },
		requests: [skillDecisionRequest(renderProfileData(profile.data), skills)],
		traceInput: { skills },
		read: (response) => {
			const probabilities = skillProbabilities(response, skills);
			const matched = matchedByProbability(skills, probabilities);
			return {
				value: matched,
				recorded: {
					matched_skills: matched,
					probabilities: Object.fromEntries(skills.map((skill, i) => [skill, probabilities[i]]))
				}
			};
		}
	});
	return value;
}

/**
 * The matcher's score on TypeSafe's Jev (match-decisions.ts): five factor
 * questions about one job, combined into the number the prompt's `score` was.
 * `variables` are the prompt's own, as the matcher fills them for
 * `score_job_match`; the profile is loaded here, as the prompt loads it, less
 * the fields MATCH_PROFILE_LEAVES_OUT names.
 *
 * A state over Jev's size limit is asked again with the posting cut
 * (MATCH_DESCRIPTION_CUT). Recorded by recordDecision, and throws as it does,
 * so the matcher can fall back to the prompt. Writes no text: the summary,
 * strengths and gaps are written when someone opens the job
 * (match-explanation.ts).
 */
export async function decideMatchScore(
	profileId: number,
	variables: Record<string, unknown>
): Promise<{ score: number; factors: ScoreFactors; aiChatId: number }> {
	const profile = await loadProfileData(profileId, undefined, {
		exclude: [...NON_FIT_FIELDS, ...MATCH_PROFILE_LEAVES_OUT]
	});
	const values: Record<string, string> = {
		...promptValues(variables),
		data: renderProfileData(profile.data)
	};
	const { value, aiChatId } = await recordDecision({
		profileId,
		promptKey: MATCH_SCORE_PROMPT,
		model: MATCH_SCORE_MODEL,
		fingerprint: matchDecisionFingerprint(),
		context: { ...variables, data: profile.data },
		requests: [matchDecisionRequest(values), matchDecisionRequest(values, true)],
		traceInput: { job: values['job.title'] ?? null },
		read: (response) => {
			const decided = matchScoreFrom(response);
			return { value: decided, recorded: { score: decided.score, ...decided.factors } };
		}
	});
	return { ...value, aiChatId };
}
