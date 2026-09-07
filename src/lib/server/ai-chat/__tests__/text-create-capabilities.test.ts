/**
 * Tests for the verbs that START an interview-prep text.
 *
 * The property every one of these is about: a create decides a title and
 * nothing else. The version verbs guarantee that a text changes only when a
 * person takes a version from its timeline, and a create that could carry
 * content would walk around that guarantee on the one row where it matters
 * most: a new one, which has no timeline and no diff and would simply BE
 * whatever the agent sent. A suite that only checked "a row was written" would
 * pass just as happily for the implementation that broke it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {}, dbDirect: {} }));

/** Titles already on the profile, per test. */
let existing: string[] = [];
const created = vi.fn();

vi.mock('$lib/server/texts/profile-texts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/texts/profile-texts')>();
	const stub = (kind: 'story' | 'cheat_sheet') => ({
		...actual.TEXT_KINDS[kind],
		list: () =>
			Promise.resolve(
				existing.map((label, index) => ({
					id: index + 1,
					label,
					applicationId: null,
					committed: null,
					path: `/applications/interview/${kind}/${index + 1}`
				}))
			),
		create: (profileId: number, title: string) => {
			created(kind, profileId, title);
			return Promise.resolve({
				id: 77,
				label: title,
				applicationId: null,
				committed: null,
				path: `/applications/interview/${kind}/77`
			});
		}
	});

	return {
		...actual,
		TEXT_KINDS: { ...actual.TEXT_KINDS, story: stub('story'), cheat_sheet: stub('cheat_sheet') }
	};
});

const { TEXT_CREATE_KIND_NAMES, TEXT_KINDS, TEXT_KIND_NAMES } =
	await import('$lib/server/texts/profile-texts');
const { TEXT_CREATE_CAPABILITIES, TEXT_CREATE_CAPABILITY_NAMES, isTextCreateCapability } =
	await import('../text-create-capabilities');

const ACTOR = { profileId: 12, isStaff: false };
const PROFILE = { id: 12, label: 'their Interview Prep' };

/** The state `validate` is handed, read the way a real call reads it. */
const stateFor = (capability: 'add_story' | 'add_cheat_sheet') =>
	TEXT_CREATE_CAPABILITIES[capability].current(PROFILE, ACTOR);

beforeEach(() => {
	existing = [];
	created.mockClear();
});

describe('which kinds may be started at all', () => {
	it('gives every listed kind a create, and no other kind one', () => {
		// The policy is written out in TEXT_CREATE_KIND_NAMES and the mechanism is
		// the optional `create` on the def. This is the test that doc comment
		// promises: the two cannot drift, in either direction. A kind added to the
		// list without an implementation would otherwise ship a tool that throws,
		// and a `create` added quietly to letters would be reachable the moment
		// someone appended a name here.
		for (const kind of TEXT_KIND_NAMES) {
			const listed = (TEXT_CREATE_KIND_NAMES as readonly string[]).includes(kind);
			expect(Boolean(TEXT_KINDS[kind].create), kind).toBe(listed);
		}
	});

	it('leaves the two kinds that assert something about an employer alone', () => {
		// A letter is a document on an application and a question says a company
		// asked something. Minting either is inventing history, which is the line
		// this whole surface is drawn around.
		expect(TEXT_CREATE_CAPABILITY_NAMES).toEqual(['add_story', 'add_cheat_sheet']);
		expect(isTextCreateCapability('add_letter')).toBe(false);
		expect(isTextCreateCapability('add_question')).toBe(false);
	});
});

describe('what a create is allowed to decide', () => {
	it('takes a title and offers nowhere to put the text', () => {
		// The whole design in one assertion. A content field here would make the
		// first version of every agent-made text invisible to the timeline that is
		// supposed to gate it.
		for (const capability of TEXT_CREATE_CAPABILITY_NAMES) {
			const fields = Object.keys(TEXT_CREATE_CAPABILITIES[capability].fields);
			expect(fields, capability).toEqual([`${capability.slice('add_'.length)}_title`]);
		}
	});

	it('tells the agent its job is only half done', () => {
		const note = TEXT_CREATE_CAPABILITIES.add_cheat_sheet.appliedNote?.(
			{ id: 77, label: 'Freelance vs. permanent' },
			{ name: 'Interview Prep', path: '/applications/interview' }
		);
		expect(note).toContain('EMPTY');
		expect(note).toContain('add_cheat_sheet_version');
		expect(note).toContain('77');
	});

	it('says in the contract that the text comes later', () => {
		for (const capability of TEXT_CREATE_CAPABILITY_NAMES) {
			const contract = TEXT_CREATE_CAPABILITIES[capability].contract;
			expect(contract, capability).toContain('created empty');
			expect(contract, capability).toContain(`${capability}_version`);
		}
	});
});

describe('validate', () => {
	it('refuses a blank title', async () => {
		const state = await stateFor('add_story');
		expect(TEXT_CREATE_CAPABILITIES.add_story.validate({ story_title: '   ' }, state)).toEqual({
			ok: false,
			error: expect.stringContaining('story_title')
		});
	});

	it('refuses a title the column cannot hold', async () => {
		// varchar(255). Refused here rather than at the insert, where it surfaces
		// as a driver error the agent cannot act on.
		const state = await stateFor('add_cheat_sheet');
		const result = TEXT_CREATE_CAPABILITIES.add_cheat_sheet.validate(
			{ cheat_sheet_title: 'x'.repeat(256) },
			state
		);
		expect(result.ok).toBe(false);
	});

	it('refuses a second one on a subject already covered', async () => {
		// Not a card the applicant declines: a duplicate they have to find and
		// delete. The refusal names the version verb, because adding to the one
		// that exists is what was actually wanted.
		existing = ['Freelance vs. permanent'];
		const state = await stateFor('add_cheat_sheet');
		const result = TEXT_CREATE_CAPABILITIES.add_cheat_sheet.validate(
			{ cheat_sheet_title: 'freelance vs. PERMANENT' },
			state
		);
		expect(result).toEqual({
			ok: false,
			error: expect.stringContaining('add_cheat_sheet_version')
		});
	});

	it('allows a new subject', async () => {
		existing = ['Strengths & Weaknesses'];
		const state = await stateFor('add_cheat_sheet');
		expect(
			TEXT_CREATE_CAPABILITIES.add_cheat_sheet.validate(
				{ cheat_sheet_title: 'Freelance vs. permanent' },
				state
			)
		).toEqual({ ok: true });
	});
});

describe('apply', () => {
	it('writes the row under the profile it authorized against', async () => {
		const state = await stateFor('add_cheat_sheet');
		const target = await TEXT_CREATE_CAPABILITIES.add_cheat_sheet.apply(
			PROFILE,
			{ cheat_sheet_title: '  Freelance vs. permanent  ' },
			state,
			ACTOR
		);

		expect(created).toHaveBeenCalledWith('cheat_sheet', 12, 'Freelance vs. permanent');
		// The row it made, not the profile it was added to. Without this the change
		// log names "their Interview Prep" and nothing downstream can say which
		// sheet an accepted proposal produced, or write its first version.
		expect(target).toEqual({ id: 77, label: 'Freelance vs. permanent' });
	});
});

describe('authorize', () => {
	it('refuses a target that is not the acting profile', async () => {
		expect(
			await TEXT_CREATE_CAPABILITIES.add_story.authorize({ id: 13, label: 'someone else' }, ACTOR)
		).toBe(false);
	});
});
