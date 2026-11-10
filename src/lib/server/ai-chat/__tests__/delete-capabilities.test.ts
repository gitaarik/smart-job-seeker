/**
 * `delete_<section>`: an entry removed for good, asked for by an agent over MCP
 * and confirmed twice by the applicant.
 *
 * What is pinned here is what makes it safe to offer at all: it exists for
 * every section and only over MCP, it can never be undone and says so, its card
 * lists the entry and everything the cascade takes along, and the write it
 * finally makes is the editors' own `deleteRow`. That it is always a request is
 * in tiers.test.ts, and that approving it needs the second confirmation is in
 * requests.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
	files: [] as Array<{ title: string | null; filename: string | null }>,
	counts: [] as Array<{ resource: string; count: number }>,
	row: null as Record<string, unknown> | null,
	deleted: [] as unknown[][],
	refuse: null as string | null
};

vi.mock('$lib/server/db', () => {
	const chain = {
		select: () => chain,
		from: () => chain,
		where: () => chain,
		orderBy: () => Promise.resolve(state.files)
	};
	return { db: chain, dbDirect: chain };
});

vi.mock('$lib/server/profile/write', () => ({
	deleteRow: (...args: unknown[]) => {
		state.deleted.push(args);
		return Promise.resolve(
			state.refuse ? { ok: false, error: state.refuse } : { ok: true, row: { id: args[2] } }
		);
	},
	readOwnedRow: () => Promise.resolve(state.row)
}));

const editor = {
	resolve: vi.fn(),
	resolveMany: vi.fn(),
	authorize: vi.fn(),
	current: vi.fn()
};

vi.mock('../profile-capabilities', () => ({
	PROFILE_CAPABILITIES: new Proxy({}, { get: () => editor }),
	PROFILE_CAPABILITY_NAMES: ['edit_language', 'add_language', 'hide_skill', 'show_skill'],
	descendantCounts: () => Promise.resolve(state.counts)
}));

const {
	DELETE_CAPABILITIES,
	DELETE_CAPABILITY_NAMES,
	DELETED_WITH,
	deletedWith,
	deletedWithChange,
	isDeleteCapability
} = await import('../delete-capabilities');
const { PROFILE_RESOURCE_NAMES } = await import('$lib/server/profile/resources');
const { PROFILE_CAPABILITY_NAMES } = await import('../profile-capabilities');

const ACTOR = { profileId: 12, isStaff: false };
const PROJECT = { id: 336, label: 'G2i - Code review for AI model training' };

beforeEach(() => {
	state.files = [];
	state.counts = [];
	state.row = null;
	state.deleted = [];
	state.refuse = null;
});

describe('the verbs', () => {
	it('exist for every section', () => {
		for (const name of PROFILE_RESOURCE_NAMES) {
			expect(isDeleteCapability(`delete_${name}`), name).toBe(true);
		}
		expect(DELETE_CAPABILITY_NAMES).toHaveLength(PROFILE_RESOURCE_NAMES.length);
		expect(isDeleteCapability('delete_resume_version')).toBe(false);
	});

	it('can never be undone, and say so to whatever decides how to ask', () => {
		for (const [name, def] of Object.entries(DELETE_CAPABILITIES)) {
			expect(def.irreversible, name).toBe(true);
			expect(def.revert, name).toBeUndefined();
			expect(def.tierFor?.({}, {}), name).toEqual({
				tier: 2,
				reason: 'Deleting an entry cannot be undone.'
			});
		}
	});

	it('are not among the verbs a chat page is offered', () => {
		// The page offers verbs from the generated list; the deletes are only in
		// the MCP server's (see tools.test.ts).
		for (const name of DELETE_CAPABILITY_NAMES) {
			expect(PROFILE_CAPABILITY_NAMES as string[]).not.toContain(name);
		}
	});

	it('carry no fields: naming the entry is the whole request', () => {
		for (const [name, def] of Object.entries(DELETE_CAPABILITIES)) {
			expect(def.fields, name).toEqual({});
		}
	});
});

describe('what goes with the entry', () => {
	it('counts what is filed under it and names the attached files', async () => {
		state.counts = [{ resource: 'work_experience_project_technology', count: 1 }];
		state.files = [
			{ title: 'Annotate v3.html', filename: 'annotate.html' },
			{ title: null, filename: 'feedback.eml' },
			{ title: null, filename: null }
		];

		expect(await deletedWith('work_experience_project', 270, ACTOR)).toEqual([
			'1 role project technology',
			'3 files: Annotate v3.html, feedback.eml, Untitled file'
		]);
	});

	it('names the first few files and counts the rest', async () => {
		state.files = Array.from({ length: 9 }, (_, i) => ({ title: `File ${i + 1}`, filename: null }));

		const [line] = await deletedWith('side_project', 4, ACTOR);
		expect(line).toBe('9 files: File 1, File 2, File 3, File 4, File 5, and 4 more');
	});

	it('counts in the plural from two', async () => {
		state.counts = [
			{ resource: 'work_experience_achievement', count: 4 },
			{ resource: 'work_experience_project', count: 2 },
			{ resource: 'work_experience_project_technology', count: 1 }
		];

		expect(await deletedWith('work_experience', 8, ACTOR)).toEqual([
			'4 role achievements',
			'2 role projects',
			'1 role project technology'
		]);
	});

	it('says a certificate takes its upload along', async () => {
		state.row = { id: 3, file_id: 'f2b1' };
		expect(await deletedWith('certificate', 3, ACTOR)).toEqual(['its uploaded file']);

		state.row = { id: 3, file_id: null };
		expect(await deletedWith('certificate', 3, ACTOR)).toEqual([]);
	});

	it('takes nothing along from a section with no children and no files', async () => {
		expect(await deletedWith('language', 1, ACTOR)).toEqual([]);
	});
});

describe('the card', () => {
	const def = () => DELETE_CAPABILITIES.delete_work_experience_project;

	it('records the entry as it reads now, and what goes with it', async () => {
		state.counts = [{ resource: 'work_experience_project_technology', count: 1 }];
		const current = {
			'work_experience_project.name': 'G2i Assignment #1',
			// What the edit verb offers beside the row, which is not part of it.
			parents: ['AI Trainer at G2i', 'AI Engineer at Rik Wanders Software'],
			translationLocales: ['nl']
		};

		expect(await def().beforeImage?.(PROJECT, current, ACTOR, {})).toEqual({
			'work_experience_project.name': 'G2i Assignment #1',
			[DELETED_WITH]: ['1 role project technology']
		});
	});

	it('lists the values going to nothing, in English only, then what goes with them', () => {
		const changes = def().describeChanges?.(
			{},
			{
				'work_experience_project.name': 'G2i Assignment #1',
				'work_experience_project.description': 'I signed up at G2i.',
				'work_experience_project.description.nl': 'Ik meldde me aan.',
				'work_experience_project.url': null,
				[DELETED_WITH]: ['1 role project technology', '3 files: a, b, c']
			}
		);

		expect(changes).toEqual([
			{ field: 'work_experience_project.name', label: 'Name', from: 'G2i Assignment #1', to: '—' },
			{
				field: 'work_experience_project.description',
				label: 'Description',
				from: 'I signed up at G2i.',
				to: '—'
			},
			{
				field: DELETED_WITH,
				label: 'Deleted with it',
				from: '1 role project technology; 3 files: a, b, c',
				to: '—'
			}
		]);
	});

	it('adds nothing for a deletion that took nothing along, or that did not record it', () => {
		expect(deletedWithChange({ [DELETED_WITH]: [] })).toEqual([]);
		expect(deletedWithChange({ 'work_experience_project.name': 'x' })).toEqual([]);
	});
});

describe('the write', () => {
	it('is the editors’ own delete, on the applicant’s profile', async () => {
		await DELETE_CAPABILITIES.delete_work_experience_project.apply(PROJECT, {}, {}, ACTOR, {
			source: 'mcp'
		});
		expect(state.deleted).toEqual([['work_experience_project', { profileId: 12 }, 336]]);
	});

	it('fails loudly when the delete is refused, so the request goes back to waiting', async () => {
		state.refuse = 'That role project is not on this profile.';
		await expect(
			DELETE_CAPABILITIES.delete_work_experience_project.apply(PROJECT, {}, {}, ACTOR, {
				source: 'mcp'
			})
		).rejects.toThrow(/refused at write time: That role project is not on this profile/);
	});
});
