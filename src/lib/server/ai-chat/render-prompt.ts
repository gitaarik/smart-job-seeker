/**
 * Prompt templates are filled by LangChain's f-string renderer.
 *
 * The templates in prompt-templates.ts are written with `${name}` placeholders,
 * plus a few `{{name}}` ones in the scraping prompts. LangChain's f-string
 * format writes a placeholder as `{name}` and wants every literal brace doubled,
 * so a template is converted on its way in rather than rewritten at the source:
 * the prompts stay as they are written, and so do the ones already stored in
 * `ai_chats`, which follow-ups render again.
 *
 * What this replaces was a find-and-replace loop, and it had two faults:
 *
 *  - It replaced one variable at a time across the growing text, so a value
 *    inserted early had its own text rewritten by a later variable. A scanned
 *    file containing `${message}` came out holding the user's chat message.
 *    LangChain fills in one pass and never reads a value back.
 *  - It left a placeholder with no value in the prompt as literal text and said
 *    nothing, which is how the matcher's work-location preference never reached
 *    the scorer after a key rename. LangChain throws instead.
 *
 * Only the f-string format checks. LangChain's mustache format renders a
 * missing variable as "" and refuses to validate a template at all.
 *
 * Neither checks a value's type: anything that is not a string reaches the model
 * as JSON, including undefined and null as the words "undefined" and "null".
 * Those two count as no value here, the same as a variable nobody passed.
 */
import { parseTemplate, renderTemplate } from '@langchain/core/prompts';

/**
 * The template as a LangChain f-string: every literal brace doubled, then each
 * placeholder, in either syntax, turned back into a single-braced `{name}`.
 */
function toFString(template: string): string {
	return template
		.replace(/[{}]/g, (brace) => brace + brace)
		.replace(/\$\{\{([^{}]+)\}\}/g, '{$1}')
		.replace(/\{\{\{\{([^{}]+)\}\}\}\}/g, '{$1}');
}

/** The variables a template uses, each once, in order of first use. */
export function promptVariables(template: string): string[] {
	const names = new Set<string>();
	for (const node of parseTemplate(toFString(template), 'f-string')) {
		if (node.type === 'variable') names.add(node.name);
	}
	return [...names];
}

/**
 * Variables as the text a prompt receives: a string as it is, anything else as
 * indented JSON. undefined and null are left out, and so is anything JSON has
 * no text for, so a template that uses one of them sees a missing value.
 */
export function promptValues(variables: Record<string, unknown>): Record<string, string> {
	const values: Record<string, string> = {};
	for (const [name, value] of Object.entries(variables)) {
		if (value === undefined || value === null) continue;
		const text: string | undefined =
			typeof value === 'string' ? value : JSON.stringify(value, null, 2);
		if (text !== undefined) values[name] = text;
	}
	return values;
}

/** The variables a template uses that have no value: not passed, undefined or null. */
export function unfilledVariables(template: string, variables: Record<string, unknown>): string[] {
	return promptVariables(template).filter(
		(name) => !Object.prototype.hasOwnProperty.call(variables, name) || variables[name] == null
	);
}

/**
 * Fill a template's placeholders with `variables`.
 *
 * A placeholder with no value, undefined and null included, throws LangChain's
 * INVALID_PROMPT_INPUT error, unless `blankMissing` is set, which renders it as
 * "". That is for a template stored in `ai_chats` and rendered again: a gap in
 * it is history, not a caller that can still be fixed.
 */
export function renderPrompt(
	template: string,
	variables: Record<string, string | null | undefined>,
	{ blankMissing = false }: { blankMissing?: boolean } = {}
): string {
	const values = promptValues(variables);
	if (blankMissing) {
		for (const name of unfilledVariables(template, values)) values[name] = '';
	}
	return renderTemplate(toFString(template), 'f-string', values);
}
