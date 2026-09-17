import { describe, expect, it } from 'vitest';
import { promptTemplates } from '../prompt-templates';
import { promptValues, promptVariables, renderPrompt, unfilledVariables } from '../render-prompt';

describe('renderPrompt', () => {
	it('fills ${name} placeholders', () => {
		expect(renderPrompt('Hello ${name}!', { name: 'Alice' })).toBe('Hello Alice!');
	});

	it('fills {{name}} placeholders', () => {
		expect(renderPrompt('Hello {{name}}!', { name: 'Alice' })).toBe('Hello Alice!');
	});

	it('fills every occurrence, in either syntax', () => {
		expect(renderPrompt('${x} + {{x}} = 2${x}', { x: '1' })).toBe('1 + 1 = 21');
	});

	it('fills dotted names', () => {
		const template = 'Remote preferences: ${preferences.work_location}';
		expect(renderPrompt(template, { 'preferences.work_location': 'remote' })).toBe(
			'Remote preferences: remote'
		);
	});

	it('keeps literal braces in the template', () => {
		const template = 'Return {"score": number, "notes": {"why": string}} for ${job}';
		expect(renderPrompt(template, { job: 'Acme' })).toBe(
			'Return {"score": number, "notes": {"why": string}} for Acme'
		);
	});

	it('handles empty values, empty templates and templates without placeholders', () => {
		expect(renderPrompt('Hello ${name}!', { name: '' })).toBe('Hello !');
		expect(renderPrompt('', { x: 'y' })).toBe('');
		expect(renderPrompt('plain text\non two lines', {})).toBe('plain text\non two lines');
	});

	it('throws on a placeholder with no value', () => {
		expect(() => renderPrompt('${known} ${unknown}', { known: 'yes' })).toThrow(
			/Missing value for input unknown/
		);
	});

	it('throws on a placeholder whose value is undefined or null', () => {
		// Rendered, these would read "undefined" and "null" with every check satisfied.
		expect(() => renderPrompt('Question: ${question}', { question: undefined })).toThrow(
			/Missing value for input question/
		);
		expect(() => renderPrompt('Company: ${company}', { company: null })).toThrow(
			/Missing value for input company/
		);
	});

	it('renders a placeholder with no value as "" when asked to', () => {
		expect(renderPrompt('${known}|${unknown}|', { known: 'yes' }, { blankMissing: true })).toBe(
			'yes||'
		);
		expect(renderPrompt('${a}|${b}|', { a: undefined, b: null }, { blankMissing: true })).toBe(
			'||'
		);
	});

	it('never fills in placeholders inside an inserted value', () => {
		// The find-and-replace this replaced went one variable at a time, so the
		// evidence below came out holding the user's message.
		const template = 'Evidence: ${evidence}\nUser: ${message}';
		const evidence = 'throw new Error(`${message}`); render("{{message}}", {a: 1})';
		expect(renderPrompt(template, { evidence, message: 'Add Spanish' })).toBe(
			`Evidence: ${evidence}\nUser: Add Spanish`
		);
	});
});

describe('promptVariables', () => {
	it('lists each variable once, in either syntax, in order of first use', () => {
		const template = 'Job: ${jobDetails}\nPage: {{html}}\nAgain: ${jobDetails} ${job.title}';
		expect(promptVariables(template)).toEqual(['jobDetails', 'html', 'job.title']);
	});

	it('does not mistake literal JSON for a variable', () => {
		expect(promptVariables('Return {"score": number} for ${job}')).toEqual(['job']);
	});
});

describe('promptValues', () => {
	it('keeps strings, writes anything else as indented JSON, and leaves out undefined and null', () => {
		expect(
			promptValues({
				question: 'Why us?',
				empty: '',
				salary: 85000,
				skills: ['Python', 'Django'],
				offer: { remote: true },
				company: null,
				notes: undefined
			})
		).toEqual({
			question: 'Why us?',
			empty: '',
			salary: '85000',
			skills: '[\n  "Python",\n  "Django"\n]',
			offer: '{\n  "remote": true\n}'
		});
	});
});

describe('unfilledVariables', () => {
	it('counts a variable not passed, undefined or null, but not an empty string', () => {
		const template = '${a} ${b} ${c} ${d}';
		expect(unfilledVariables(template, { b: undefined, c: null, d: '' })).toEqual(['a', 'b', 'c']);
	});
});

describe('every prompt template', () => {
	const braces = (text: string) => (text.match(/[{}]/g) ?? []).length;

	it('renders with its own variables, keeping every literal brace', () => {
		for (const [key, t] of Object.entries(promptTemplates)) {
			for (const [half, template] of [
				['system_prompt', t.system_prompt],
				['user_prompt', t.user_prompt]
			] as const) {
				const names = promptVariables(template);
				const rendered = renderPrompt(
					template,
					Object.fromEntries(names.map((name) => [name, '<value>']))
				);
				const literal = names.reduce(
					(text, name) => text.replaceAll(`\${${name}}`, '').replaceAll(`{{${name}}}`, ''),
					template
				);

				expect(braces(rendered), `${key}.${half} lost or gained a brace`).toBe(braces(literal));
				expect(rendered, `${key}.${half} kept a placeholder`).not.toMatch(
					/\$\{[^{}]+\}|\{\{[^{}]+\}\}/
				);
			}
		}
	});
});
