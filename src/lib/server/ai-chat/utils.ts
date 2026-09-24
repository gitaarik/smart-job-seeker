/**
 * Shared utilities for AI chat prompt handling
 */

import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { ai_chats, collected_data, profiles } from '$lib/server/db/schema';
import { config } from '$lib/server/config';
import { errorTracker } from '$lib/server/monitoring/error-tracker';
import {
	type ChatMessage,
	extractionFallback,
	generateChatCompletionTracked,
	isFatalLLMError,
	isLLMOutputValidationMessage,
	type TokenUsage,
	writingFallback,
	z
} from '$lib/server/llm';
import { getSchemaForPrompt } from '$lib/server/schemas/ai-prompt-schemas';
import { promptTemplates } from './prompt-templates.js';
import { promptFingerprint } from './prompt-fingerprint';
import { tokensToCost } from '$lib/server/billing/credits';
import { describeSpendBlock, getSpendEligibility } from '$lib/server/account/spend-eligibility';
import { estimateProviderCostUsd } from '$lib/server/billing/provider-costs';
import { assembleGenerationContext, type ContextRequest } from './generation-context';
import type { ExportedProfileKey } from '$lib/server/profile/export';
import type { RetrievalRecord } from '$lib/server/documents/retrieval-record';
import type { CapabilityRecord } from './capability-record';
import { applySkillVisibility, loadProfileData, renderProfileData } from './profile-data';
import { promptValues, renderPrompt, unfilledVariables } from './render-prompt';

/**
 * User-facing writing prompts run on the writing provider/model
 * (config.llmWriting*), typically a stronger/paid model (Gemini) chosen for
 * prose quality. Everything else — extraction, scraping helpers, matching —
 * runs on the app provider/model (config.llmProvider/llmModel), which the
 * structured, transform-bearing schemas are tuned for (Groq gpt-oss).
 *
 * Gemini's structured-output mode rejects field-level Zod `.transform()`s
 * (e.g. extract_job_data's salary coercion → "Transforms cannot be represented
 * in JSON Schema"), so extraction MUST stay on the app provider. Any NEW
 * user-facing writing prompt must be added here; everything else defaults to
 * the extraction provider.
 */
const WRITING_PROMPT_KEYS = new Set<string>([
	'personal_agent_chat',
	'personal_agent_chat_capable',
	'write_cover_letter',
	'write_or_advise_cover_letter',
	'advise_cover_letter',
	'review_cover_letter',
	'write_cheat_sheet',
	'write_or_advise_cheat_sheet',
	'advise_cheat_sheet',
	'review_cheat_sheet',
	'answer_application_question',
	'write_or_advise_application_question',
	'advise_application_question',
	'review_application_question',
	'revise_application_question',
	'followup_application_question',
	'write_star_story',
	'write_or_advise_star_story',
	'advise_star_story',
	'review_star_story',
	'followup_star_story',
	'write_prep_sheet',
	'write_or_advise_prep_sheet',
	'advise_prep_sheet',
	'review_prep_sheet',
	'followup_prep_sheet',
	'followup',
	'followup_letter'
]);

/**
 * Non-writing prompts that may fail over to the extraction fallback.
 *
 * An ALLOWLIST rather than the denylist the writing split uses, because the two
 * fail in opposite directions. Forgetting to add a prompt here costs it a
 * failover, which is where everything started. Forgetting to EXCLUDE one from a
 * denylist would hand failover to a prompt whose output is a judgement, and the
 * matcher is exactly that: `score_job_match` writes a number the jobs list
 * filters on, so a handful of rows scored by a second model would reorder a
 * ranking against a baseline no golden run has ever seen, invisibly, because a
 * fallback call looks exactly like a successful one.
 *
 * So the judgement prompts are absent on purpose and should stay absent:
 * score_job_match, extract_matched_skills, tailor_resume_selection,
 * suggest_import_tasks. So is anything whose
 * output is prose a person reads — that belongs in WRITING_PROMPT_KEYS if it
 * belongs anywhere.
 *
 * What is here is the extractive half: a scrape that has already spent minutes
 * of browser time, and the parses a user is sitting in front of.
 */
export const EXTRACTION_FALLBACK_PROMPT_KEYS = new Set<string>([
	'extract_job_data',
	'extract_job_header',
	'extract_jobs_from_search_page',
	'find_next_page_button',
	'compact_job_description',
	'extract_document',
	'extract_qa_pairs',
	'propose_project_from_code'
]);

/**
 * Format the applicant's own free-text brief for a prompt's
 * `${additionalContext}` slot — what they typed in the editor's composer
 * before asking for advice or a draft.
 *
 * Returns "" when blank so the slot collapses to nothing (the no-brief case is
 * the common one, and an empty header would read as a missing instruction).
 * When present it gets a header, so the model reads it as the applicant
 * speaking rather than as a continuation of the job or profile data above it,
 * and an explicit note that it does not override the output format — a brief
 * like "just give me bullet points" must not break a structured-JSON contract.
 */
export function instructionsBlock(text?: string | null): string {
	const trimmed = text?.trim();
	if (!trimmed) return '';
	return `## What the applicant asked for

Follow this as far as it makes sense. It does NOT override the output format required above.

${trimmed}`;
}

/**
 * Combine system prompt, replayed conversation turns and user prompt into a
 * full prompt with distinctive headers. This is the debugging record of what
 * the model actually received (`ai_chats.full_prompt`) — the turns are sent as
 * separate messages, not as this concatenation, so the headers exist to make
 * the message boundaries legible when reading a stored prompt back.
 */
export function makeFullPrompt(
	systemPrompt: string,
	userPrompt: string,
	historyMessages: ChatMessage[] = []
): string {
	const history =
		historyMessages.length > 0
			? `

----------------

# CONVERSATION SO FAR (sent as separate messages):

----------------

${historyMessages.map((m) => `## ${m.role.toUpperCase()}:\n\n${m.content}`).join('\n\n')}
`
			: '';

	return `----------------

# SYSTEM PROMPT:

----------------

${systemPrompt}

${history}
----------------

# USER PROMPT:

----------------

${userPrompt}`;
}

/**
 * Get prompt template by key identifier.
 * Reads from code-defined templates (prompt-templates.ts).
 */
function fetchPromptTemplate(key: string): {
	id: number;
	system_prompt: string;
	user_prompt: string;
	/** Undefined means the shared default — see PromptTemplate.temperature. */
	temperature?: number;
	format: string | null;
} | null {
	const template = promptTemplates[key];

	if (!template?.system_prompt || !template?.user_prompt) {
		return null;
	}

	return {
		id: 0, // Not used for code-defined templates
		system_prompt: template.system_prompt,
		user_prompt: template.user_prompt,
		temperature: template.temperature,
		format: null
	};
}

/**
 * The stored profile blob with skill visibility applied: held-back skills
 * dropped when `documentSafe`, and the flag itself stripped either way, as
 * loadProfileData does for a new call.
 *
 * Hands back the original string untouched when there was nothing to resolve,
 * so re-interpolating a chat doesn't gratuitously reformat its own prompt — and
 * likewise if it won't parse, since a prompt built from an odd blob beats one
 * that throws on the way out.
 */
function visibleProfileData(stored: string | null | undefined, documentSafe: boolean): string {
	if (!stored) return '{}';
	let parsed: unknown;
	try {
		parsed = JSON.parse(stored);
	} catch {
		return stored;
	}
	if (typeof parsed !== 'object' || parsed === null) return stored;

	const visible = applySkillVisibility(parsed as Record<string, unknown>, documentSafe);
	return visible === parsed ? stored : JSON.stringify(visible, null, 2);
}

/**
 * Fetch and interpolate prompts for an AI chat
 * Returns system_prompt and user_prompt with ${schema} and ${data} replaced,
 * and any other placeholder left empty
 */
export async function getInterpolatedPrompts(aiChatId: number): Promise<{
	systemPrompt: string;
	userPrompt: string;
	/** Null on rows written before `ai_chats.prompt_key` existed. */
	promptKey: string | null;
} | null> {
	// Fetch the ai_chatss record
	const aiChat = await db.query.ai_chats.findFirst({
		where: eq(ai_chats.id, aiChatId),
		columns: { system_prompt: true, user_prompt: true, profile_id: true, prompt_key: true }
	});

	if (!aiChat) {
		return null;
	}

	// Fetch the collected_data for this profile
	const collectedDataRecord = await db.query.collected_data.findFirst({
		where: eq(collected_data.profile_id, aiChat.profile_id),
		columns: { schema: true, data: true }
	});

	// Prepare replacements (use empty objects as defaults).
	//
	// A row records the template it came from (`prompt_key`), so the profile is
	// document-safe exactly when createAndGenerateAiChat made it so: for the
	// writing prompts. Rows written before that column existed cannot say, so
	// they take the conservative reading: withholding a held-back skill from an
	// analysis is recoverable, putting one into a document the applicant sends
	// is not.
	const documentSafe = aiChat.prompt_key == null || WRITING_PROMPT_KEYS.has(aiChat.prompt_key);
	const variables = {
		schema: collectedDataRecord?.schema || '{}',
		data: visibleProfileData(collectedDataRecord?.data, documentSafe)
	};

	// Interpolate variables in both prompts. A stored template, so a gap is blank.
	const systemPrompt = renderPrompt(aiChat.system_prompt, variables, { blankMissing: true });
	const userPrompt = renderPrompt(aiChat.user_prompt, variables, { blankMissing: true });

	return {
		systemPrompt,
		userPrompt,
		promptKey: aiChat.prompt_key ?? null
	};
}

/**
 * Create and fully generate an AI chat instance using the prompt templates in
 * prompt-templates.ts.
 * Orchestrates the entire process:
 * 1. Looks the prompt template up by key in prompt-templates.ts
 * 2. Fetches collected_data for the profile to get schema and data
 * 3. Merges standard variables (schema, data) with custom variables
 * 4. Interpolates prompts with all variables (stringifying JSON as needed)
 * 5. Creates ai_chats record with template prompts and original context values
 * 6. Saves interpolated full_prompt
 * 7. Generates response via Groq API with interpolated prompts
 * 8. Returns the complete ai_chats record
 *
 * @param profileId - The profile ID for this AI chat
 * @param promptKey - Key into `promptTemplates` in prompt-templates.ts
 * @param customVariables - Optional custom variables (strings or objects) for interpolation and context
 * @param followupTo - Optional parent ai_chats ID if this is a follow-up
 * @returns Object with success status, message, and the created ai_chats record (if successful)
 */
export async function createAndGenerateAiChat(
	profileId: number,
	promptKey: string,
	customVariables?: Record<string, unknown>,
	followupTo?: number,
	options?: {
		/** Top-level profile data keys to include. If omitted, all data is included. */
		profileDataFields?: ExportedProfileKey[];
		/**
		 * Top-level profile data keys to REMOVE, applied after
		 * `profileDataFields`. For a prompt that wants nearly the whole blob but
		 * demonstrably not one or two parts of it, this is the safe direction to
		 * express that: an allow-list silently starves the prompt the next time
		 * the export grows a field. See NON_SKILL_FIELDS in profile-data.ts.
		 */
		profileDataExclude?: ExportedProfileKey[];
		/**
		 * Evidence to assemble for this generation — which sources, what it's
		 * about, how big a budget. Assembled here and merged into the interpolation
		 * variables, so a call site declares intent instead of hand-wiring
		 * retrieval and then spreading the result. See generation-context.ts.
		 *
		 * `profileId` comes from the argument above; `profileFields` defaults to
		 * `profileDataFields` so there is one profile field list, not two.
		 * Explicit `customVariables` still win, as an escape hatch.
		 */
		context?: Omit<ContextRequest, 'profileId' | 'preloadedProfile'>;
		/**
		 * What the caller was allowed to propose on this turn, for the row.
		 *
		 * Passed in rather than assembled here, unlike the retrieval record: the
		 * capability decision belongs to the agent chat and is made before the
		 * prompt is built (it decides WHICH prompt is built — capable or plain).
		 * This function only stores it. See ai-chat/capability-record.ts.
		 */
		capabilityRecord?: CapabilityRecord;
		/**
		 * Prior turns of this thread, replayed between the system prompt and the
		 * new user message so the model sees an actual conversation rather than a
		 * recap of one. Built by conversation-messages.ts from the version trail.
		 */
		historyMessages?: ChatMessage[];
		/**
		 * Schema override for prompts whose output shape isn't fixed at the prompt
		 * key. The assistant's capability replies are the case this exists for:
		 * which edits are proposable depends on the page and the user's rights, so
		 * the schema is built per turn (see capabilities.buildProposalSchema)
		 * rather than looked up in the static registry.
		 */
		responseSchema?: z.ZodType<unknown>;
		/**
		 * Fallbacks for placeholders a template references but this call may not
		 * fill — spread BENEATH the assembled evidence, so they cover the gaps
		 * without overwriting anything real.
		 *
		 * The distinction matters, and getting it wrong is silent. A caller whose
		 * template references every context placeholder has to pre-fill them with
		 * "" or the call fails outside production (an unsupplied one used to ship
		 * to the model as the literal text "${jobDetails}"). Doing that through
		 * `customVariables` looks equivalent
		 * and is not: customVariables are the deliberate override and win over
		 * assembled evidence, so the empties blank the very sources the call just
		 * paid to assemble. That is exactly what happened to the personal
		 * assistant — it requested job, records, documents, projects, stories and
		 * past texts on every application page and then overwrote all six with ""
		 * before the model saw them.
		 */
		placeholderDefaults?: Record<string, string>;
	}
): Promise<{
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
}> {
	// Track aiChat ID so we can save errors to the record if creation succeeds but generation fails
	let aiChatId: number | undefined;
	// Set when the model call starts, so a failed call records how long it took too.
	let callStarted: number | undefined;

	try {
		// Two questions before doing any work, and they are not the same one.
		// "May this account cause spend at all" fails for an expired demo, an
		// unapproved account and a pending erasure; all three still pass the
		// budget check below, and matching charges no credits anyway. Asked
		// first, so a profile whose owner is gone never reaches getBalance,
		// which upserts into credit_balances and throws on the missing FK.
		const profile = await db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			columns: { user_id: true }
		});
		if (profile?.user_id) {
			const eligibility = await getSpendEligibility(profile.user_id);
			if (!eligibility.allowed) {
				return {
					success: false,
					message: `AI operations are disabled for this account: ${describeSpendBlock(eligibility.reason)}.`
				};
			}
			const { getBalance } = await import('$lib/server/billing/credits');
			const balance = await getBalance(profile.user_id);
			if (balance.available <= 0) {
				return {
					success: false,
					message: 'Out of credits. Please upgrade your plan or buy extra credits.'
				};
			}
		}

		// Step 1: Get prompt template from code
		const promptTemplate = fetchPromptTemplate(promptKey);

		if (!promptTemplate) {
			return {
				success: false,
				message: `AI prompt template not found for key: '${promptKey}'. Please ensure it exists in prompt-templates.ts.`
			};
		}

		// Step 2/3: Fetch and field-filter the collected_data blob. Shared with the
		// context provider's `profile` source, which renders this same object.
		const profileDataFields = options?.context?.profileFields ?? options?.profileDataFields;
		// Writing prompts speak for the applicant, so they don't get skills kept
		// off documents. Everything else — scoring above all — needs the whole
		// profile, or it reports a skill the applicant just added as a gap.
		const profileBlob = await loadProfileData(profileId, profileDataFields, {
			documentSafe: WRITING_PROMPT_KEYS.has(promptKey),
			exclude: options?.profileDataExclude
		});
		const schemaJson = profileBlob.schema;
		const dataJson = profileBlob.data;

		// Step 3b: Assemble the declared evidence. Every requested source gets a
		// key (empty string when it found nothing), so a template referencing a
		// placeholder never ships a literal `${…}` to the model.
		let assembled: Record<string, string> = {};
		// What retrieval picked, kept aside for the row. It is stored separately
		// from `context` (which carries the same evidence as rendered prose) so it
		// survives the retention pass that nulls the bulky prompt columns — the
		// questions it answers are asked long after the generation.
		let retrieval: RetrievalRecord | null = null;
		if (options?.context) {
			const ctx = await assembleGenerationContext({
				...options.context,
				profileId,
				profileFields: profileDataFields,
				// Already loaded above for ${schema} — don't pay for it twice.
				preloadedProfile: profileBlob
			});
			assembled = ctx.variables;
			retrieval = ctx.retrieval;
		}

		// Step 4: Prepare context (raw variables as JSON objects)
		const context = {
			schema: schemaJson,
			data: dataJson,
			...(options?.placeholderDefaults || {}),
			...assembled,
			...(customVariables || {})
		} as Record<string, unknown>;

		// Step 5: Prepare variables for interpolation (stringified for prompts).
		// Layered lowest-to-highest: placeholder fallbacks, then the base blob,
		// then assembled evidence (the `profile` source renders `data` under the
		// budget), then explicit customVariables, which are the override. A
		// customVariable that is undefined or null overrides nothing: promptValues
		// leaves it out rather than sending the model "undefined" or "null".
		const interpolationVariables: Record<string, string> = {
			...(options?.placeholderDefaults || {}),
			schema: JSON.stringify(schemaJson, null, 2),
			data: renderProfileData(dataJson),
			...assembled,
			...promptValues(customVariables ?? {})
		};

		// Step 5b: Every placeholder the template uses must have a value by now,
		// even if it is only the "" a placeholderDefaults entry gives it. The
		// renderer would refuse a gap on its own, but it names only the first
		// one and not the prompt, so the whole list is worked out here.
		// Outside production a gap fails the call, so the caller is fixed while
		// someone is looking at it. In production the answer is still worth
		// having, so the gap is reported and rendered as "".
		const unfilled = [
			...new Set([
				...unfilledVariables(promptTemplate.system_prompt, interpolationVariables),
				...unfilledVariables(promptTemplate.user_prompt, interpolationVariables)
			])
		];
		if (unfilled.length > 0) {
			// Say which ones the caller did pass, as undefined or null: the fix for
			// those is wherever the value came from, not the call.
			const described = unfilled.map((name) => {
				const passed = customVariables?.[name];
				return customVariables && name in customVariables && passed == null
					? `${name} (passed as ${passed})`
					: name;
			});
			const problem = new Error(
				`Prompt '${promptKey}' has no value for: ${described.join(', ')}. ` +
					`Supply it from the caller, or pass "" through placeholderDefaults.`
			);
			if (!config.isProduction) throw problem;
			errorTracker.logError('Unfilled prompt placeholders', problem, {
				operation: 'createAndGenerateAiChat',
				metadata: { promptKey, unfilled }
			});
		}

		// Step 6: Fill both prompts with the stringified variables (render-prompt.ts)
		const interpolatedSystemPrompt = renderPrompt(
			promptTemplate.system_prompt,
			interpolationVariables,
			{ blankMissing: config.isProduction }
		);
		const interpolatedUserPrompt = renderPrompt(
			promptTemplate.user_prompt,
			interpolationVariables,
			{ blankMissing: config.isProduction }
		);

		// Resolve provider/model by prompt type: user-facing writing runs on the
		// writing provider/model, everything else on the app (extraction) provider.
		// Used for the record stamp, generation, and cost accounting alike.
		const isWritingPrompt = WRITING_PROMPT_KEYS.has(promptKey);
		const activeProvider = isWritingPrompt ? config.llmWritingProvider : config.llmProvider;
		const activeModel = isWritingPrompt ? config.llmWritingModel : config.llmModel;
		// Failover target by class: writing gets the writing pair, the extractive
		// prompts get the extraction pair (off by default), and everything left —
		// the judgements — gets none. See llm/fallback.ts for why the two classes
		// want different providers, and EXTRACTION_FALLBACK_PROMPT_KEYS above for
		// why that last group is a silence rather than an omission.
		const fallback = isWritingPrompt
			? writingFallback()
			: EXTRACTION_FALLBACK_PROMPT_KEYS.has(promptKey)
				? extractionFallback()
				: undefined;

		// Step 7: Create the ai_chats record with template prompts (not interpolated)
		const [aiChat] = await db
			.insert(ai_chats)
			.values({
				profile_id: profileId,
				system_prompt: promptTemplate.system_prompt,
				user_prompt: promptTemplate.user_prompt,
				context: JSON.parse(JSON.stringify(context)),
				retrieval,
				capabilities: options?.capabilityRecord ?? null,
				followup_to: followupTo,
				prompt_key: promptKey,
				prompt_fingerprint: promptFingerprint(promptTemplate),
				date_created: new Date(),
				provider: activeProvider,
				model: activeModel,
				request_type: 'llm'
			})
			.returning();
		aiChatId = aiChat.id;

		// Step 6: Generate and save full_prompt (interpolated combination)
		const historyMessages = options?.historyMessages ?? [];
		const fullPrompt = makeFullPrompt(
			interpolatedSystemPrompt,
			interpolatedUserPrompt,
			historyMessages
		);

		await db.update(ai_chats).set({ full_prompt: fullPrompt }).where(eq(ai_chats.id, aiChat.id));

		// Step 7: Generate AI response using generic LLM function
		// Schema from the caller when the shape is decided per call, else the code
		// registry keyed by prompt (no longer the database format field).
		const zodSchema = options?.responseSchema ?? getSchemaForPrompt(promptKey);
		const structuredOutput = zodSchema
			? {
					name: promptKey.replace(/[^a-zA-Z0-9_]/g, '_'),
					schema: zodSchema
				}
			: undefined;

		callStarted = performance.now();
		const completionResult = await generateChatCompletionTracked(
			[
				{ role: 'system', content: interpolatedSystemPrompt },
				...historyMessages,
				{ role: 'user', content: interpolatedUserPrompt }
			],
			{
				structuredOutput,
				provider: activeProvider,
				model: activeModel,
				fallback,
				// Undefined leaves generateChatCompletionTracked on its own default.
				temperature: promptTemplate.temperature,
				promptKey
			}
		);

		const durationMs = Math.round(performance.now() - callStarted);

		// Step 8: Save response + token usage
		const responseContent = completionResult.content;
		const responseToSave = structuredOutput
			? (() => {
					try {
						return JSON.stringify(JSON.parse(responseContent));
					} catch {
						return responseContent;
					}
				})()
			: responseContent;

		const usage = completionResult.usage;
		const creditsCost = usage ? tokensToCost(usage.totalTokens) : 0;

		/**
		 * What actually generated this, which is not always what the row was
		 * stamped with at insert time: the stamp is written before the call, and a
		 * writing call that failed over ran somewhere else.
		 *
		 * Re-stamping is not cosmetic. estimateProviderCostUsd prices by
		 * "provider/model" and returns null on a key it doesn't know, so a row left
		 * claiming the primary is a row priced against a model that never ran —
		 * and /admin/costs groups by these two columns, so the error compounds
		 * rather than showing up as one odd number.
		 */
		const ranOn = completionResult.fallbackUsed ?? {
			provider: activeProvider,
			model: activeModel
		};

		await db
			.update(ai_chats)
			.set({
				response: responseToSave,
				provider: ranOn.provider,
				model: ranOn.model,
				input_tokens: usage?.inputTokens ?? null,
				output_tokens: usage?.outputTokens ?? null,
				total_tokens: usage?.totalTokens ?? null,
				cached_input_tokens: usage?.cachedInputTokens ?? null,
				reasoning_tokens: usage?.reasoningTokens ?? null,
				duration_ms: durationMs,
				credits_charged: creditsCost || null
			})
			.where(eq(ai_chats.id, aiChat.id));

		// Charge credits if we have a user and usage
		if (usage && creditsCost > 0) {
			const profileForCredits = await db.query.profiles.findFirst({
				where: eq(profiles.id, profileId),
				columns: { user_id: true }
			});
			if (profileForCredits?.user_id) {
				const { chargeCredits } = await import('$lib/server/billing/credits');
				const providerCostUsd = estimateProviderCostUsd(
					ranOn.provider,
					ranOn.model,
					usage.inputTokens,
					usage.outputTokens,
					usage.cachedInputTokens,
					usage.reasoningTokens
				);
				await chargeCredits(
					profileForCredits.user_id,
					creditsCost,
					'ai_generation',
					`${promptKey} (${usage.totalTokens} tokens)`,
					{
						aiChatId: aiChat.id,
						promptKey,
						tokens: usage,
						provider: ranOn.provider,
						model: ranOn.model,
						providerCostUsd
					}
				);
			}
		}

		// Step 9: Fetch and return the complete ai_chats record
		const completeAiChat = await db.query.ai_chats.findFirst({
			where: eq(ai_chats.id, aiChat.id),
			columns: {
				id: true,
				profile_id: true,
				system_prompt: true,
				user_prompt: true,
				full_prompt: true,
				response: true,
				date_created: true,
				date_updated: true
			}
		});

		if (!completeAiChat) {
			return {
				success: false,
				message: `Failed to retrieve created ai_chats record with ID ${aiChat.id}`
			};
		}

		return {
			success: true,
			message: `AI chat created and generated successfully`,
			aiChat: completeAiChat
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		// Save error to ai_chats record if it was created, with the tokens the
		// call really spent when the failure carries them. A structured-output
		// failure is billed by the provider exactly like a success, and this is
		// the only path that can record it — the usual save happens after a
		// return that never came. The user is not charged credits for it (that
		// is further down the success path), but the cost is real and belongs in
		// the table that tracks cost.
		if (aiChatId) {
			const usage = (error as { usage?: TokenUsage })?.usage;
			await db
				.update(ai_chats)
				.set({
					error: errorMessage,
					...(callStarted !== undefined
						? { duration_ms: Math.round(performance.now() - callStarted) }
						: {}),
					...(usage
						? {
								input_tokens: usage.inputTokens,
								output_tokens: usage.outputTokens,
								total_tokens: usage.totalTokens,
								cached_input_tokens: usage.cachedInputTokens,
								reasoning_tokens: usage.reasoningTokens
							}
						: {})
				})
				.where(eq(ai_chats.id, aiChatId));
			console.error(`      📋 Error details: ai_chat ID ${aiChatId}`);
		}

		// Re-throw fatal LLM errors so they can abort scraping
		if (isFatalLLMError(error)) {
			throw error;
		}

		// The model answering in an unusable shape is a retryable hiccup, not
		// something the user can act on, and this message is rendered straight
		// into the chat panel. "Error creating and generating ai_chats: Failed to
		// generate JSON matching personal_agent_chat_capable" is a sentence for
		// whoever is reading the logs — and the logs still get it, along with
		// ai_chats.error above, which is where it belongs.
		if (isLLMOutputValidationMessage(errorMessage)) {
			return {
				success: false,
				message: "The assistant's answer didn't come back in a usable form. Please try again."
			};
		}

		return {
			success: false,
			message: `Error creating and generating ai_chats: ${errorMessage}`
		};
	}
}
