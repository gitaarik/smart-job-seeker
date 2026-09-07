/**
 * Tests for the verb that writes a version of a text without changing the text.
 *
 * The property every one of these is about: nothing here may reach the column
 * the applicant reads. A version is a proposal in a timeline, the timeline is
 * where they accept it, and a test suite that only checked "a row was written"
 * would pass just as happily for an implementation that overwrote the letter.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeStarMarkdown } from '$lib/interview/star';

vi.mock('$lib/server/db', () => ({ db: {}, dbDirect: {} }));

const recordVersion = vi.fn();
const ensureBaselineVersion = vi.fn();

vi.mock('../entity-versions', async (importOriginal) => ({
	...(await importOriginal<typeof import('../entity-versions')>()),
	recordVersion: (...args: unknown[]) => recordVersion(...args),
	ensureBaselineVersion: (...args: unknown[]) => ensureBaselineVersion(...args)
}));

/** One letter and one story, both on profile 12 and neither on 13. */
const ROWS: Record<string, Record<string, unknown>> = {
	'letter:3': {
		id: 3,
		label: 'Cover letter',
		applicationId: 44,
		committed: 'The letter as it was saved.',
		path: '/applications/44/texts/3'
	},
	'story:8': {
		id: 8,
		label: 'The migration',
		applicationId: null,
		committed: serializeStarMarkdown({ situation: 'It was slow.', task: 'Speed it up.' }),
		path: '/applications/interview/stories/8'
	}
};

/** What the trail looks like, per test. Empty by default. */
let trail: { count: number; content: string | null } | null = null;

vi.mock('$lib/server/texts/profile-texts', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/texts/profile-texts')>()),
	readOwnedText: (kind: string, id: number, profileId: number) =>
		Promise.resolve(profileId === 12 ? (ROWS[`${kind}:${id}`] ?? null) : null),
	summarizeTextVersions: (_kind: string, ids: number[]) =>
		Promise.resolve(
			trail
				? new Map(
						ids.map((id) => [
							id,
							{
								count: trail!.count,
								latest: { id: 99, content: trail!.content, source: 'ai_revision', date: null }
							}
						])
					)
				: new Map()
		)
}));

const { TEXT_CAPABILITIES } = await import('../text-version-capabilities');
const { TEXT_READ_CHARS } = await import('$lib/server/texts/profile-texts');
const { tierForWrite } = await import('$lib/server/mcp/tiers');

const ACTOR = { profileId: 12, isStaff: false };
const LETTER = { id: 3, label: 'Cover letter', path: '/applications/44/texts/3' };
const STORY = { id: 8, label: 'The migration', path: '/applications/interview/stories/8' };

const letterVerb = TEXT_CAPABILITIES.add_letter_version;
const storyVerb = TEXT_CAPABILITIES.add_story_version;

beforeEach(() => {
	vi.clearAllMocks();
	trail = null;
});

describe('what it reads before writing', () => {
	it('takes the saved text when the trail is empty', async () => {
		const current = await letterVerb.current(LETTER, ACTOR);
		expect(current.text).toBe('The letter as it was saved.');
		expect(current.versions).toBe(0);
		expect(current.latest_is_current).toBe(true);
	});

	it('takes the newest version when there is one, and says it is not the letter', async () => {
		// The same rule the app's own revision path follows: an agent revising
		// anything other than what the editor would revise is proposing against a
		// version of the letter nobody is looking at.
		trail = { count: 2, content: 'A version nobody has taken.' };
		const current = await letterVerb.current(LETTER, ACTOR);
		expect(current.text).toBe('A version nobody has taken.');
		expect(current.latest_is_current).toBe(false);
	});

	it('counts an advice turn as leaving the text where it was', async () => {
		trail = { count: 1, content: null };
		const current = await letterVerb.current(LETTER, ACTOR);
		expect(current.text).toBe('The letter as it was saved.');
		expect(current.latest_is_current).toBe(true);
	});

	it('does not resolve from a page, so the chat is never offered it', async () => {
		expect(await letterVerb.resolve(null, ACTOR)).toBeNull();
	});

	it('refuses a row on another profile', async () => {
		expect(await letterVerb.authorize(LETTER, ACTOR)).toBe(true);
		expect(await letterVerb.authorize(LETTER, { profileId: 13, isStaff: false })).toBe(false);
	});
});

describe('what it refuses', () => {
	it('refuses a version with no text', () => {
		const result = letterVerb.validate({ letter_content: '   ' }, { text: 'anything' });
		expect(result.ok).toBe(false);
	});

	it('refuses a version identical to the text it would replace', () => {
		const result = letterVerb.validate(
			{ letter_content: '  The letter as it was saved.  ' },
			{ text: 'The letter as it was saved.' }
		);
		expect(result).toMatchObject({ ok: false });
		expect('error' in result && result.error).toMatch(/word for word/);
	});

	it('refuses a story that only reformats the same STAR sections', () => {
		// Normalized before the comparison, or every re-serialization of a story
		// would read as a change and stack a version saying nothing.
		const result = storyVerb.validate(
			{ story_content: '**Situation**\nIt was slow.\n\n**Task**\nSpeed it up.' },
			{ text: ROWS['story:8'].committed }
		);
		expect(result).toMatchObject({ ok: false });
	});

	it('refuses to rewrite a text longer than one read', () => {
		// It came back in slices, so a rewrite is a rewrite of the first slice and
		// the rest would disappear with nothing saying so.
		const long = 'x'.repeat(TEXT_READ_CHARS + 1);
		const result = letterVerb.validate({ letter_content: 'a shorter letter' }, { text: long });
		expect(result).toMatchObject({ ok: false });
		expect('error' in result && result.error).toMatch(/longer than/);
	});

	it('accepts a real rewrite', () => {
		expect(
			letterVerb.validate({ letter_content: 'Something else entirely.' }, { text: 'The old one.' })
		).toEqual({ ok: true });
	});
});

describe('what it writes', () => {
	it('appends a version and touches nothing else', async () => {
		await letterVerb.apply(
			LETTER,
			{ letter_content: 'A tighter opening.', letter_note: 'Cut the throat-clearing.' },
			{ text: 'The letter as it was saved.' },
			ACTOR
		);

		// The baseline first: a letter written before the trail existed has no
		// rows, and without this the agent's version becomes the only one.
		expect(ensureBaselineVersion).toHaveBeenCalledBefore(recordVersion);
		expect(ensureBaselineVersion.mock.calls[0][2]).toBe('The letter as it was saved.');

		const [, version] = recordVersion.mock.calls[0];
		expect(version).toMatchObject({
			entityId: 3,
			content: 'A tighter opening.',
			source: 'agent_revision',
			aiFeedback: 'Cut the throat-clearing.'
		});
	});

	it('never puts words in the applicant’s own message', async () => {
		// `user_request` renders as their bubble in the timeline — editable and
		// resendable. What they asked an outside agent for was not said here.
		await letterVerb.apply(
			LETTER,
			{ letter_content: 'A tighter opening.', letter_note: 'Shorter.' },
			{ text: 'old' },
			ACTOR
		);
		expect(recordVersion.mock.calls[0][1].userRequest).toBeUndefined();
	});

	it('stores a story as canonical STAR markdown', async () => {
		await storyVerb.apply(
			STORY,
			{ story_content: 'Situation:\nIt broke.\n\nTask:\nFix it.' },
			{ text: 'old' },
			ACTOR
		);
		expect(recordVersion.mock.calls[0][1].content).toBe(
			serializeStarMarkdown({ situation: 'It broke.', task: 'Fix it.' })
		);
	});
});

describe('what it tells the agent afterwards', () => {
	it('says the letter has not changed', () => {
		const note = letterVerb.appliedNote?.(LETTER, {
			name: 'letter',
			path: '/applications/44/texts/3'
		});
		expect(note).toContain('/applications/44/texts/3');
		expect(note).toMatch(/has changed yet/);
		expect(note).not.toMatch(/\bupdated\b(?!\.)/i);
	});
});

describe('how much friction it earns', () => {
	it('is additive even over a letter that is already written', () => {
		// The generic grading calls a write over a non-empty field an overwrite,
		// which is right for a column and wrong for an append. `add_` is checked
		// first, and this is the test that says so on purpose rather than by luck.
		expect(
			tierForWrite({
				capability: 'add_letter_version',
				current: { text: 'A letter the applicant wrote themselves.' },
				fields: { letter_content: 'A rewrite.' },
				recentDirectWrites: 0
			})
		).toMatchObject({ tier: 1 });
	});

	it('still becomes a request once an agent has been busy', () => {
		expect(
			tierForWrite({
				capability: 'add_letter_version',
				current: { text: 'anything' },
				fields: { letter_content: 'A rewrite.' },
				recentDirectWrites: 20
			})
		).toMatchObject({ tier: 2 });
	});
});
