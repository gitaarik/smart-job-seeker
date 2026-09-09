/**
 * Tests for the verbs that START a text.
 *
 * The property every one of these is about: a create decides what NAMES the row
 * and nothing else. The version verbs guarantee that a text changes only when a
 * person takes a version from its timeline, and a create that could carry
 * content would walk around that guarantee on the one row where it matters
 * most: a new one, which has no timeline and no diff and would simply BE
 * whatever the agent sent. A suite that only checked "a row was written" would
 * pass just as happily for the implementation that broke it.
 *
 * The second thing under test is the split the letter introduced. Two kinds
 * hang off the profile and are named by a title; one hangs off an application
 * and is named by its type. Everything downstream of that — what it targets,
 * what it authorizes, which list it checks for a duplicate — differs, and the
 * cases below are paired so a branch that answers the profile's question for an
 * application fails rather than passing quietly.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {}, dbDirect: {} }));

/** Labels already on the profile, or on the application, per test. */
let existing: string[] = [];
/** The one application this profile owns. */
const OWNED_APPLICATION = 55;

const inserted = vi.fn();
const listed = vi.fn();

vi.mock('$lib/server/applications/profile-applications', () => ({
	readProfileApplication: (id: number, profileId: number) =>
		Promise.resolve(
			id === OWNED_APPLICATION && profileId === 12
				? { id, job_title: 'Staff Engineer', job_company: 'Acme' }
				: null
		)
}));

vi.mock('$lib/server/texts/profile-texts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/texts/profile-texts')>();

	const stub = (kind: 'letter' | 'story' | 'cheat_sheet') => {
		const def = actual.TEXT_KINDS[kind];
		const create = def.create;
		return {
			...def,
			list: (profileId: number, opts: { applicationId?: number; limit: number }) => {
				listed(kind, profileId, opts);
				return Promise.resolve(
					existing.map((label, index) => ({
						id: index + 1,
						label,
						applicationId: null,
						committed: null,
						path: `/texts/${kind}/${index + 1}`
					}))
				);
			},
			create: {
				...create,
				insert: (ownerId: number, value: string) => {
					inserted(kind, ownerId, value);
					return Promise.resolve({
						id: 77,
						// What the list will call it: the type's label for a letter, and
						// the title itself for the two that carry one.
						label:
							create.decides === 'choice'
								? (create.choices.find((choice) => choice.value === value)?.label ?? value)
								: value,
						applicationId: null,
						committed: null,
						path: `/texts/${kind}/77`
					});
				}
			}
		};
	};

	return {
		...actual,
		TEXT_KINDS: {
			...actual.TEXT_KINDS,
			letter: stub('letter'),
			story: stub('story'),
			cheat_sheet: stub('cheat_sheet')
		}
	};
});

const { TEXT_CREATE_KIND_NAMES, TEXT_KINDS, TEXT_KIND_NAMES } =
	await import('$lib/server/texts/profile-texts');
const { TEXT_CREATE_CAPABILITIES, TEXT_CREATE_CAPABILITY_NAMES, isTextCreateCapability } =
	await import('../text-create-capabilities');

const ACTOR = { profileId: 12, isStaff: false };
const PROFILE = { id: 12, label: 'their Interview Prep' };
const APPLICATION = { id: OWNED_APPLICATION, label: 'Staff Engineer at Acme' };

/** The target each capability is called with: an application, or the profile. */
const targetFor = (capability: (typeof TEXT_CREATE_CAPABILITY_NAMES)[number]) =>
	capability === 'add_letter' ? APPLICATION : PROFILE;

/** The state `validate` is handed, read the way a real call reads it. */
const stateFor = (capability: (typeof TEXT_CREATE_CAPABILITY_NAMES)[number]) =>
	TEXT_CREATE_CAPABILITIES[capability].current(targetFor(capability), ACTOR);

beforeEach(() => {
	existing = [];
	inserted.mockClear();
	listed.mockClear();
});

describe('which kinds may be started at all', () => {
	it('gives every listed kind a create, and no other kind one', () => {
		// The policy is written out in TEXT_CREATE_KIND_NAMES and the mechanism is
		// the optional `create` on the def. This is the test that doc comment
		// promises: the two cannot drift, in either direction. A kind added to the
		// list without an implementation would otherwise ship a tool that throws.
		for (const kind of TEXT_KIND_NAMES) {
			const listedKind = (TEXT_CREATE_KIND_NAMES as readonly string[]).includes(kind);
			expect(Boolean(TEXT_KINDS[kind].create), kind).toBe(listedKind);
		}
	});

	it('leaves the one kind that asserts something about an employer alone', () => {
		// A question's label IS what the employer asked, so minting one asserts
		// that a company said something. That is inventing history, which is the
		// line this whole surface is drawn around. A letter is not that: it is a
		// document started under an application the applicant already made, and it
		// lands empty.
		expect(TEXT_CREATE_CAPABILITY_NAMES).toEqual(['add_letter', 'add_story', 'add_cheat_sheet']);
		expect(isTextCreateCapability('add_question')).toBe(false);
	});
});

describe('what a create is allowed to decide', () => {
	it('takes one naming field and offers nowhere to put the text', () => {
		// The whole design in one assertion. A content field here would make the
		// first version of every agent-made text invisible to the timeline that is
		// supposed to gate it.
		for (const capability of TEXT_CREATE_CAPABILITY_NAMES) {
			const kind = capability.slice('add_'.length) as (typeof TEXT_CREATE_KIND_NAMES)[number];
			const fields = Object.keys(TEXT_CREATE_CAPABILITIES[capability].fields);
			expect(fields, capability).toEqual([TEXT_KINDS[kind].create.field]);
		}
	});

	it('names a letter by its type, because a letter has no title', () => {
		expect(Object.keys(TEXT_CREATE_CAPABILITIES.add_letter.fields)).toEqual(['letter_type']);
		expect(TEXT_CREATE_CAPABILITIES.add_letter.requiredFields).toEqual(['letter_type']);
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

	it('tells the agent a letter needs an application that exists', () => {
		// The failure this heads off is an agent reading "start a new letter" as
		// permission to start the application too, or as a call it can make with
		// no application at all.
		const contract = TEXT_CREATE_CAPABILITIES.add_letter.contract;
		expect(contract).toContain('application_id');
		expect(contract).toContain('does not create the application');
		expect(contract).toContain('cover_letter');
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

	it('refuses a letter type that does not exist', async () => {
		// The two values are the two the page's own New button offers. A free
		// string here would put a letter on the list under a name it has no label
		// for, which is what `letter_type` being a varchar allows and this refuses.
		const state = await stateFor('add_letter');
		const result = TEXT_CREATE_CAPABILITIES.add_letter.validate(
			{ letter_type: 'thank_you_note' },
			state
		);
		expect(result).toEqual({ ok: false, error: expect.stringContaining('cover_letter') });
	});

	it('takes a type the model capitalised its own way', async () => {
		const state = await stateFor('add_letter');
		expect(
			TEXT_CREATE_CAPABILITIES.add_letter.validate({ letter_type: ' Cover_Letter ' }, state)
		).toEqual({ ok: true });
	});

	it('refuses a second letter of a type the application already has', async () => {
		// The duplicate check compares what the LIST calls them, so it catches
		// "cover_letter" against the "Cover letter" row rather than against a
		// column value nobody sees.
		existing = ['Cover letter'];
		const state = await stateFor('add_letter');
		expect(
			TEXT_CREATE_CAPABILITIES.add_letter.validate({ letter_type: 'cover_letter' }, state)
		).toEqual({ ok: false, error: expect.stringContaining('add_letter_version') });
	});

	it('allows the other type on an application that has one already', async () => {
		existing = ['Cover letter'];
		const state = await stateFor('add_letter');
		expect(
			TEXT_CREATE_CAPABILITIES.add_letter.validate({ letter_type: 'cheat_sheet' }, state)
		).toEqual({ ok: true });
	});
});

describe('what it checks for a duplicate', () => {
	it('asks about the application for a letter, and the profile for the rest', async () => {
		await stateFor('add_letter');
		expect(listed).toHaveBeenCalledWith(
			'letter',
			12,
			expect.objectContaining({
				applicationId: OWNED_APPLICATION
			})
		);

		listed.mockClear();
		await stateFor('add_story');
		// Every letter on the profile would answer a question nobody asked, and
		// half of them are on applications this call cannot touch. A story has no
		// application to be scoped by at all.
		expect(listed).toHaveBeenCalledWith(
			'story',
			12,
			expect.not.objectContaining({
				applicationId: expect.anything()
			})
		);
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

		expect(inserted).toHaveBeenCalledWith('cheat_sheet', 12, 'Freelance vs. permanent');
		// The row it made, not the profile it was added to. Without this the change
		// log names "their Interview Prep" and nothing downstream can say which
		// sheet an accepted proposal produced, or write its first version.
		expect(target).toEqual({ id: 77, label: 'Freelance vs. permanent' });
	});

	it('writes a letter under the application, not the profile', async () => {
		// The one that would be silently wrong: 12 is a real application id
		// somewhere, so a create that passed the profile id here would write a
		// letter onto somebody else's application rather than failing.
		const state = await stateFor('add_letter');
		const target = await TEXT_CREATE_CAPABILITIES.add_letter.apply(
			APPLICATION,
			{ letter_type: 'Cover_Letter' },
			state,
			ACTOR
		);

		expect(inserted).toHaveBeenCalledWith('letter', OWNED_APPLICATION, 'cover_letter');
		expect(target).toEqual({ id: 77, label: 'Cover letter' });
	});
});

describe('authorize', () => {
	it('refuses a target that is not the acting profile', async () => {
		expect(
			await TEXT_CREATE_CAPABILITIES.add_story.authorize({ id: 13, label: 'someone else' }, ACTOR)
		).toBe(false);
	});

	it('refuses an application the profile does not own, and takes the one it does', async () => {
		// An application id is a global address the way a profile id is not, so
		// this is the check standing between an agent naming a number and a letter
		// appearing on a stranger's application.
		expect(await TEXT_CREATE_CAPABILITIES.add_letter.authorize(APPLICATION, ACTOR)).toBe(true);
		expect(
			await TEXT_CREATE_CAPABILITIES.add_letter.authorize({ id: 999, label: 'theirs' }, ACTOR)
		).toBe(false);
	});
});
