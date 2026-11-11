import { describe, expect, test } from 'vitest';
import { KEY_SKILLS_PER_LINE, keySkillLines, lineSkills } from './key-skills';
import { siteLists } from './site-lists';

const skills = (...names: string[]) => names.map((name, i) => ({ id: i + 1, name }));

describe('keySkillLines', () => {
	test("one line per group, naming its first skills in the profile's order", () => {
		const lines = keySkillLines([
			{
				id: 1,
				fa_icon: 'python',
				tech_skills: skills('Python', 'Django', 'DRF', 'FastAPI', 'Flask')
			},
			{ id: 2, fa_icon: null, tech_skills: skills('RAG', 'MCP') }
		]);
		expect(lines).toEqual([
			{ key: 1, text: 'Python, Django, DRF, FastAPI', icon: 'python' },
			{ key: 2, text: 'RAG, MCP', icon: null }
		]);
		expect(KEY_SKILLS_PER_LINE).toBe(4);
	});

	test('a skill with no name takes no place on the line, and a group of only those prints none', () => {
		const lines = keySkillLines([
			{ id: 1, tech_skills: skills('', 'Go', '  ', 'Rust', 'Zig', 'C') },
			{ id: 2, tech_skills: skills(' ') }
		]);
		expect(lines).toEqual([{ key: 1, text: 'Go, Rust, Zig, C', icon: null }]);
	});

	test('reads what the site shows: a skill or group switched off the site is not on the box', () => {
		const { skillCategories } = siteLists(
			{
				profile_versions: [],
				tech_skill_categories: [
					{
						id: 1,
						tech_skills: [
							{ id: 10, name: 'Python' },
							{ id: 11, name: 'Internal DSL', tags: ['!portfolio'] },
							{ id: 12, name: 'Django', tags: ['!resume', '!cv'] }
						]
					},
					{ id: 2, tags: ['!portfolio'], tech_skills: [{ id: 20, name: 'Hidden group skill' }] }
				]
			},
			null
		);
		expect(keySkillLines(skillCategories).map((l) => l.text)).toEqual(['Python, Django']);
	});
});

describe('lineSkills', () => {
	test('is the rows the line names, so a caller can keep just those', () => {
		const group = { id: 1, tech_skills: skills('A', '', 'B', 'C', 'D', 'E') };
		expect(lineSkills(group).map((s) => s.name)).toEqual(['A', 'B', 'C', 'D']);
		expect(lineSkills({ id: 2 })).toEqual([]);
	});
});
