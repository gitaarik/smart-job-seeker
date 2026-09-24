import { createHash } from 'node:crypto';
import type { PromptTemplate } from './prompt-templates';

/**
 * Which version of a template a call ran, as 16 hex characters.
 *
 * Covers both prompts and the temperature, which is the template as the model
 * receives it, and nothing else, so a comment edit in prompt-templates.ts does
 * not make a new version.
 *
 * This is the same hash cloud's llm:smoke record and the golden baselines carry
 * (cloud scripts/llm-smoke-coverage.ts imports it from here), so an `ai_chats`
 * row can be matched to the smoke run or golden run that vouched for its
 * prompt. Changing how it is computed invalidates both, and the release gate
 * then demands a paid re-run of every covered prompt.
 */
export function promptFingerprint(template: PromptTemplate): string {
	return createHash('sha256')
		.update(
			JSON.stringify([template.system_prompt, template.user_prompt, template.temperature ?? null])
		)
		.digest('hex')
		.slice(0, 16);
}
