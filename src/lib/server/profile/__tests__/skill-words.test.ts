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
	suggestPlace,
	versionChain,
	wordsToPrint,
	type SkillWord
} from '../skill-words';
import { OVERRIDE_ENTITIES } from '$lib/version-overrides';

const word = (
	id: number,
	name: string,
	categoryId = 1,
	versionId = 5,
	beforeSkillId: number | null = null
): SkillWord => ({
	id,
	versionId,
	categoryId,
	name,
	reason: null,
	beforeSkillId
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

describe('applySkillWords: where in the group', () => {
	const tree = () => ({
		profile_versions: [],
		tech_skill_categories: [
			{
				id: 1,
				tags: null,
				tech_skills: [
					{ id: 10, name: 'Docker', tags: null },
					{ id: 11, name: 'Sentry', tags: null },
					{ id: 12, name: 'Kubernetes', tags: ['!resume', '!cv'] },
					{ id: 13, name: 'Nginx', tags: null }
				] as Array<Record<string, unknown> & { id: number }>
			},
			{ id: 2, tags: null, tech_skills: [{ id: 20, name: 'Git', tags: null }] }
		]
	});
	const order = (t: ReturnType<typeof tree>) =>
		t.tech_skill_categories[0].tech_skills.map((s) => s.name);

	it('goes in front of the skill it was placed before', () => {
		const t = applySkillWords(tree(), [word(1, 'Monitoring', 1, 5, 12)], 'resume', null);
		expect(order(t)).toEqual(['Docker', 'Sentry', 'Monitoring', 'Kubernetes', 'Nginx']);
	});

	it('leads the group when placed before its first skill', () => {
		const t = applySkillWords(tree(), [word(1, 'Monitoring', 1, 5, 10)], 'resume', null);
		expect(order(t)[0]).toBe('Monitoring');
	});

	// Kubernetes is kept off this resume, so the word it was placed before
	// prints right after Sentry once the renderer's filter drops it.
	it('keeps its place when the skill it precedes does not print', () => {
		const t = applySkillWords(tree(), [word(1, 'Monitoring', 1, 5, 12)], 'resume', null);
		const printed = t.tech_skill_categories[0].tech_skills.filter((s) => !s.tags);
		expect(printed.map((s) => s.name)).toEqual(['Docker', 'Sentry', 'Monitoring', 'Nginx']);
	});

	it('keeps the order words were added in when two share a place', () => {
		const t = applySkillWords(
			tree(),
			[word(1, 'Monitoring', 1, 5, 13), word(2, 'Observability', 1, 5, 13)],
			'resume',
			null
		);
		expect(order(t).slice(-3)).toEqual(['Monitoring', 'Observability', 'Nginx']);
	});

	it('ends the group with no place, or a place the group does not hold', () => {
		const t = applySkillWords(
			tree(),
			[word(1, 'Monitoring', 1, 5, null), word(2, 'Security', 1, 5, 20)],
			'resume',
			null
		);
		expect(order(t).slice(-2)).toEqual(['Monitoring', 'Security']);
	});
});

describe('suggestPlace', () => {
	const groups = [
		{
			id: 1,
			tech_skills: [
				{ id: 10, name: 'Sentry' },
				{ id: 11, name: 'Docker' }
			]
		},
		{
			id: 2,
			tech_skills: [
				{ id: 20, name: 'Function calling' },
				{ id: 21, name: 'RAG' }
			]
		}
	];

	it('puts a word beside the skill the match credited it through', () => {
		expect(suggestPlace('Monitoring', 'sentry', groups)).toEqual({
			categoryId: 1,
			anchorSkillId: 10
		});
	});

	// "Tool Calling" was credited on the model's own judgement, so there is no
	// skill to go by but the word the two names share.
	it('falls back to a skill that shares one of its words', () => {
		expect(suggestPlace('Tool Calling', null, groups)).toEqual({
			categoryId: 2,
			anchorSkillId: 20
		});
	});

	it('does not match on filler words', () => {
		expect(
			suggestPlace('Security and Compliance', null, [
				{ id: 3, tech_skills: [{ id: 30, name: 'Rock and roll' }] }
			])
		).toEqual({
			categoryId: null,
			anchorSkillId: null
		});
	});

	it('says nothing when nothing relates', () => {
		expect(suggestPlace('Kafka', 'Pulsar', groups)).toEqual({
			categoryId: null,
			anchorSkillId: null
		});
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
				before_skill_id: null,
				version: { profile_id: 1 }
			},
			{
				id: 2,
				version_id: 5,
				category_id: 1,
				name: 'Monitoring',
				reason: 'why',
				before_skill_id: 7,
				version: { profile_id: 1 }
			},
			// A forged or stale id naming somebody else's version.
			{
				id: 3,
				version_id: 5,
				category_id: 1,
				name: 'Theirs',
				reason: null,
				before_skill_id: null,
				version: { profile_id: 2 }
			}
		]);

		expect(await loadSkillWords(1, [5, 3])).toEqual([
			{ id: 2, versionId: 5, categoryId: 1, name: 'Monitoring', reason: 'why', beforeSkillId: 7 },
			{ id: 1, versionId: 3, categoryId: 1, name: 'Testing', reason: null, beforeSkillId: null }
		]);
	});
});
