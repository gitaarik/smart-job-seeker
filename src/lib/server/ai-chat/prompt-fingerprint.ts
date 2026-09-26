import { createHash } from 'node:crypto';
import type { PromptTemplate } from './prompt-templates';

/** Every `{{name}}` as `${name}`, the form the recorded fingerprints were taken over. */
const canonicalPlaceholders = (text: string) =>
	text.replace(/\{\{([^{}]+)\}\}/g, (_, name: string) => '${' + name + '}');

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
 *
 * Placeholders are hashed as `${name}` whichever way the template writes them.
 * The templates moved to `{{name}}` on 2026-09-26, and every fingerprint the
 * smoke record and the golden baselines carried had been taken over `${name}`
 * text, so this kept all of them. The four templates that already wrote
 * `{{name}}` changed fingerprint once, and one llm:smoke run recorded them anew.
 */
export function promptFingerprint(template: PromptTemplate): string {
	return createHash('sha256')
		.update(
			JSON.stringify([
				canonicalPlaceholders(template.system_prompt),
				canonicalPlaceholders(template.user_prompt),
				template.temperature ?? null
			])
		)
		.digest('hex')
		.slice(0, 16);
}
