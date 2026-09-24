/**
 * The words a version prints that no skill on the profile holds.
 *
 * The rule under test is the one the renderer, the coverage map and the item
 * panel all share: a word prints in its group, once, down the version chain,
 * and never beside a skill of the same name the document already prints. Each
 * of those was a way to print the same word twice, which is the duplicate this
 * table exists to stop.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('$lib/server/db', () => ({
	dbDirect: { query: { profile_version_skill_words: { findMany } } }
}));

import {
	applySkillWords,
	loadSkillWords,
	renderedVersionId,
	versionChain,
	wordsToPrint,
	type SkillWord
} from '../skill-words';
import { OVERRIDE_ENTITIES } from '$lib/version-overrides';

const word = (id: number, name: string, categoryId = 1, versionId = 5): SkillWord => ({
	id,
	versionId,
	categoryId,
	name,
	reason: null
});

describe('versionChain', () => {
	const versions = [
		{ id: 5, extension_links: [{ extended_id: 3 }] },
		{ id: 3, extension_links: [{ extended_id: 1 }] },
		{ id: 1, extension_links: [] }
	];

	it('starts at the version being viewed and follows what it extends', () => {
		expect(versionChain(versions, 5)).toEqual([5, 3, 1]);
		expect(versionChain(versions, 3)).toEqual([3, 1]);
	});

	it('names nothing for a version the tree does not hold', () => {
		expect(versionChain(versions, 99)).toEqual([]);
	});

	// Nothing in the schema forbids one, and the renderer's own walk would spin.
	it('stops at a cycle', () => {
		const looped = [
			{ id: 1, extension_links: [{ extended_id: 2 }] },
			{ id: 2, extension_links: [{ extended_id: 1 }] }
		];
		expect(versionChain(looped, 1)).toEqual([1, 2]);
	});
});

describe('wordsToPrint', () => {
	it('prints each name once, the first down the chain', () => {
		const words = [word(1, 'Monitoring', 1, 5), word(2, 'monitoring', 2, 3)];
		expect(wordsToPrint(words, new Set()).map((w) => w.id)).toEqual([1]);
	});

	it('leaves out a name the skills block already prints', () => {
		expect(wordsToPrint([word(1, 'Monitoring')], new Set(['monitoring']))).toEqual([]);
	});

	it('leaves out a word whose group the document leaves out, when asked', () => {
		const words = [word(1, 'Monitoring', 1), word(2, 'Security', 2)];
		expect(wordsToPrint(words, new Set(), new Set([2])).map((w) => w.name)).toEqual(['Security']);
		// Without the groups, the renderer's own group filter decides.
		expect(wordsToPrint(words, new Set())).toHaveLength(2);
	});
});

describe('applySkillWords', () => {
	type Tree = {
		profile_versions: Array<{
			id: number;
			slug: string;
			toggles: string[];
			extension_links: Array<{ extended_id: number | null }>;
			overrides: Array<{ entity_type: string; entity_id: number; action: string }>;
		}>;
		tech_skill_categories: Array<{
			id: number;
			tags: string[] | null;
			tech_skills: Array<Record<string, unknown> & { id: number }>;
		}>;
	};

	const tree = (): Tree => ({
		profile_versions: [
			{
				id: 5,
				slug: 'app-12',
				toggles: [],
				extension_links: [],
				overrides: [{ entity_type: OVERRIDE_ENTITIES.skill, entity_id: 11, action: 'include' }]
			}
		],
		tech_skill_categories: [
			{
				id: 1,
				tags: null,
				tech_skills: [
					{ id: 10, name: 'Sentry', tags: null },
					{ id: 11, name: 'Slack', tags: ['!resume', '!cv'] },
					{ id: 12, name: 'Jira', tags: ['!resume', '!cv'] }
				]
			},
			{ id: 2, tags: null, tech_skills: [] }
		]
	});
	const names = (t: Tree, group: number) =>
		t.tech_skill_categories.find((c) => c.id === group)?.tech_skills.map((s) => s.name);

	it('appends each word to its own group, after the skills it holds', () => {
		const t = applySkillWords(
			tree(),
			[word(1, 'Monitoring', 1), word(2, 'Security', 2)],
			'resume',
			5
		);
		expect(names(t, 1)).toEqual(['Sentry', 'Slack', 'Jira', 'Monitoring']);
		expect(names(t, 2)).toEqual(['Security']);
	});

	// An override is keyed by a skill id, so a synthetic row that shared one
	// would answer to a decision about a real skill.
	it('gives a word no tags and an id no skill can have', () => {
		const t = applySkillWords(tree(), [word(7, 'Monitoring', 1)], 'resume', 5);
		expect(t.tech_skill_categories[0].tech_skills.at(-1)).toMatchObject({
			id: -7,
			name: 'Monitoring',
			tags: null
		});
	});

	it('does not print a word the document already prints as a skill', () => {
		// Slack is kept off documents, but this version shows it.
		const t = applySkillWords(tree(), [word(1, 'slack', 1)], 'resume', 5);
		expect(names(t, 1)).toEqual(['Sentry', 'Slack', 'Jira']);
	});

	// The profile's twin is kept off this document, so it cannot speak for the
	// word: dropping the word would take the name off the page altogether. The
	// tree still holds the twin; the renderer's filter is what drops it.
	it('still prints a word whose profile twin this document keeps off', () => {
		const t = applySkillWords(tree(), [word(1, 'Jira', 1)], 'resume', 5);
		expect(t.tech_skill_categories[0].tech_skills.map((s) => [s.id, s.name])).toEqual([
			[10, 'Sentry'],
			[11, 'Slack'],
			[12, 'Jira'],
			[-1, 'Jira']
		]);
	});

	it('leaves the tree alone with nothing to add, or no group to add it to', () => {
		const t = tree();
		expect(applySkillWords(t, [], 'resume', 5)).toEqual(tree());
		expect(names(applySkillWords(t, [word(1, 'Monitoring', 99)], 'resume', 5), 1)).toEqual([
			'Sentry',
			'Slack',
			'Jira'
		]);
	});
});

describe('renderedVersionId', () => {
	const profile = { profile_versions: [{ id: 5, slug: 'app-12' }] };

	it('takes the version the load resolved', () => {
		expect(renderedVersionId(profile, 3, 'app-12')).toBe(3);
	});

	// ProfileDisplay falls back to the slug in the URL on its own, and the words
	// have to follow the overrides wherever they go.
	it('falls back to the slug the renderer falls back to', () => {
		expect(renderedVersionId(profile, undefined, 'app-12')).toBe(5);
		expect(renderedVersionId(profile, null, 'nope')).toBeNull();
		expect(renderedVersionId(profile, null, null)).toBeNull();
	});
});

describe('loadSkillWords', () => {
	beforeEach(() => findMany.mockReset());

	it('asks nothing when there is no version to ask about', async () => {
		expect(await loadSkillWords(1, [])).toEqual([]);
		expect(findMany).not.toHaveBeenCalled();
	});

	it('keeps chain order, and only this profile’s words', async () => {
		findMany.mockResolvedValue([
			{
				id: 1,
				version_id: 3,
				category_id: 1,
				name: 'Testing',
				reason: null,
				version: { profile_id: 1 }
			},
			{
				id: 2,
				version_id: 5,
				category_id: 1,
				name: 'Monitoring',
				reason: 'why',
				version: { profile_id: 1 }
			},
			// A forged or stale id naming somebody else's version.
			{
				id: 3,
				version_id: 5,
				category_id: 1,
				name: 'Theirs',
				reason: null,
				version: { profile_id: 2 }
			}
		]);

		expect(await loadSkillWords(1, [5, 3])).toEqual([
			{ id: 2, versionId: 5, categoryId: 1, name: 'Monitoring', reason: 'why' },
			{ id: 1, versionId: 3, categoryId: 1, name: 'Testing', reason: null }
		]);
	});
});
