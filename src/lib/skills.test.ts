import { describe, expect, it } from 'vitest';
import { normalizeSkill, splitCompoundSkill } from './skills';

/** The parts of the reading of that kind, or undefined if it was not offered. */
function reading(label: string, kind: 'literal' | 'shared-tail' | 'shared-head') {
	return splitCompoundSkill(label).find((r) => r.kind === kind)?.parts;
}

describe('splitCompoundSkill', () => {
	it('splits the separators people actually use', () => {
		expect(reading('Agile/Scrum', 'literal')).toEqual(['Agile', 'Scrum']);
		expect(reading('Vitest / Jest', 'literal')).toEqual(['Vitest', 'Jest']);
		expect(reading('Django, Flask, FastAPI', 'literal')).toEqual(['Django', 'Flask', 'FastAPI']);
		expect(reading('Travel and Tourism', 'literal')).toEqual(['Travel', 'Tourism']);
		expect(reading('React | Vue', 'literal')).toEqual(['React', 'Vue']);
	});

	it('leaves a single skill alone', () => {
		for (const one of ['React', 'Node.js', 'Ruby on Rails', 'PostgreSQL']) {
			expect(splitCompoundSkill(one)).toEqual([]);
		}
	});

	/**
	 * The reason `+` is not a separator. normalizeSkill keeps `+` and `#` so
	 * these two survive it; a splitter that took `+` would undo that on the very
	 * skills the exception was written for.
	 */
	it('never splits C++ or C#', () => {
		expect(splitCompoundSkill('C++')).toEqual([]);
		expect(splitCompoundSkill('C#')).toEqual([]);
		expect(reading('C/C++', 'literal')).toEqual(['C', 'C++']);
	});

	it('does not mistake "and" inside a word for a separator', () => {
		expect(splitCompoundSkill('Brandenburg')).toEqual([]);
		expect(splitCompoundSkill('Hand-off')).toEqual([]);
	});

	it('restores a shared head noun', () => {
		expect(reading('Unit / Integration Testing', 'shared-tail')).toEqual([
			'Unit Testing',
			'Integration Testing'
		]);
		expect(reading('Front / Backend development', 'shared-tail')).toEqual([
			'Front development',
			'Backend development'
		]);
	});

	it('restores a shared leading word', () => {
		expect(reading('GitLab CI/CD', 'shared-head')).toEqual(['GitLab CI', 'GitLab CD']);
	});

	it('offers only the literal reading when nothing was shared', () => {
		expect(splitCompoundSkill('Agile/Scrum').map((r) => r.kind)).toEqual(['literal']);
	});

	/**
	 * Both readings are offered because neither is knowable from the string. The
	 * vocabulary decides: "AI" and "LLM integrations" are both concepts on dev,
	 * so the literal reading is the one that survives resolution.
	 */
	it('offers competing readings rather than choosing', () => {
		expect(reading('AI / LLM integrations', 'literal')).toEqual(['AI', 'LLM integrations']);
		expect(reading('AI / LLM integrations', 'shared-tail')).toEqual([
			'AI integrations',
			'LLM integrations'
		]);
	});

	it('refuses prose and punctuation', () => {
		expect(splitCompoundSkill('a, b, c, d, e')).toEqual([]);
		expect(splitCompoundSkill('React / -')).toEqual([]);
		expect(splitCompoundSkill('/')).toEqual([]);
	});

	/** Every part has to survive the same normalization the lookup will apply. */
	it('produces parts that normalize to something', () => {
		for (const r of splitCompoundSkill('Unit / Integration Testing')) {
			for (const p of r.parts) expect(normalizeSkill(p)).not.toBe('');
		}
	});
});
