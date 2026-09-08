/**
 * Tests for the verb that makes a version the text.
 *
 * Two properties carry this file, and neither of them is "a row was written".
 *
 * The first is that it always asks. `add_<kind>` starts an empty text and
 * `add_<kind>_version` writes a version beside one, and both are correctly Tier
 * 1 because neither changes what anybody reads. A commit that graded itself the
 * same way on an empty text would let those three calls put a whole document on
 * a profile with no approval anywhere in the sequence. So the tier is asserted
 * through the real `tierForWrite`, on an empty text, where the generic grading
 * says otherwise.
 *
 * The second is that the approval card shows the two TEXTS. The field is a
 * version id, and a card built from the field would read "2 → 4" and ask
 * somebody to approve prose nobody put in front of them — on the one surface
 * whose entire purpose is that they read it first.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {}, dbDirect: {} }));

/** What the row currently holds, per test. Null for a text never written. */
let committed: string | null = null;

/** The version trail, oldest first, per test. */
let trail: {
	versionId: number;
	type: string;
	content: string | null;
	date: Date | null;
}[] = [];

/** Every `setText` this suite provoked. */
const written: { kind: string; id: number; profileId: number; content: string | null }[] = [];

vi.mock('$lib/server/texts/profile-texts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/texts/profile-texts')>();

	const stub = (kind: (typeof actual.TEXT_KIND_NAMES)[number]) => ({
		...actual.TEXT_KINDS[kind],
		setText: (id: number, profileId: number, content: string | null) => {
			written.push({ kind, id, profileId, content });
			return Promise.resolve();
		}
	});

	return {
		...actual,
		TEXT_KINDS: Object.fromEntries(actual.TEXT_KIND_NAMES.map((kind) => [kind, stub(kind)])),
		readOwnedText: (kind: string, id: number) =>
			Promise.resolve(
				committed === null && trail.length === 0
					? null
					: {
							id,
							label: `the ${kind}`,
							applicationId: null,
							committed,
							path: `/texts/${id}`
						}
			)
	};
});

vi.mock('../entity-versions', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../entity-versions')>();
	return {
		...actual,
		buildConversation: () => Promise.resolve(trail),
		readVersion: (_binding: unknown, _entityId: number, versionId: number) => {
			const found = trail.find((entry) => entry.versionId === versionId);
			return Promise.resolve(
				found
					? { id: found.versionId, content: found.content, source: found.type, date: found.date }
					: null
			);
		}
	};
});

const { TEXT_COMMIT_CAPABILITIES, TEXT_COMMIT_CAPABILITY_NAMES, isTextCommitCapability } =
	await import('../text-commit-capabilities');
const { CAPABILITIES, describeProposalChanges } = await import('../capabilities');
const { dispositionFor, tierForWrite } = await import('$lib/server/mcp/tiers');

const ACTOR = { profileId: 12, isStaff: false };
const SHEET = { id: 62, label: 'Freelance vs. permanent' };

const sheet = () => TEXT_COMMIT_CAPABILITIES.use_cheat_sheet_version;

/** The state a real call is validated against, read the way a real call reads it. */
const stateFor = (capability: keyof typeof TEXT_COMMIT_CAPABILITIES = 'use_cheat_sheet_version') =>
	TEXT_COMMIT_CAPABILITIES[capability].current(SHEET, ACTOR);

/** A trail entry, defaulting to the shape an agent's own version has. */
const version = (id: number, content: string | null, type = 'agent_revision') => ({
	versionId: id,
	type,
	content,
	date: null
});

beforeEach(() => {
	committed = 'what the sheet says now';
	trail = [version(1, 'what the sheet says now', 'manual_edit'), version(4, 'the new wording')];
	written.length = 0;
});

describe('the friction it carries', () => {
	it('needs approval even when the text it replaces is empty', async () => {
		// The case the generic grading gets wrong, and the reason `tierFor` exists
		// on this capability at all. `add_cheat_sheet` makes an empty row, an
		// `add_cheat_sheet_version` writes words beside it, and both are honestly
		// Tier 1. If the commit were graded on what it replaces — nothing — the
		// three together would put a whole document on the profile with no
		// approval at any step.
		committed = null;
		trail = [version(4, 'a whole document nobody has read')];

		const decision = tierForWrite({
			capability: 'use_cheat_sheet_version',
			current: await stateFor(),
			fields: { cheat_sheet_version_id: 4 },
			recentDirectWrites: 0
		});

		expect(decision.tier).toBe(2);
	});

	it('is a request even for a key the applicant scoped to write', () => {
		// The scope is a ceiling and the tier is the floor. A `write` key makes a
		// Tier 1 add direct and must not make this one direct, or "approve in the
		// app" becomes a setting the agent's owner can switch off.
		expect(dispositionFor(2, 'write')).toBe('request');
	});

	it('grades every kind the same way', async () => {
		const current = await stateFor();
		for (const capability of TEXT_COMMIT_CAPABILITY_NAMES) {
			expect(CAPABILITIES[capability].tierFor?.({}, current)?.tier, capability).toBe(2);
		}
	});
});

describe('what it asks for', () => {
	it('takes one version id per kind and nothing else', () => {
		for (const capability of TEXT_COMMIT_CAPABILITY_NAMES) {
			const kind = capability.slice('use_'.length, -'_version'.length);
			const def = CAPABILITIES[capability];
			expect(Object.keys(def.fields), capability).toEqual([`${kind}_version_id`]);
			expect(def.requiredFields, capability).toEqual([`${kind}_version_id`]);
		}
	});

	it('keeps each kind’s field to itself', () => {
		// The chat merges every live capability's fields into one object for the
		// provider, so four capabilities all offering `version_id` would be one
		// collision away from a story's version landing on a cover letter.
		const fields = TEXT_COMMIT_CAPABILITY_NAMES.flatMap((capability) =>
			Object.keys(CAPABILITIES[capability].fields)
		);
		expect(new Set(fields).size).toBe(fields.length);
	});

	it('tells the agent nothing is written when the call returns', () => {
		for (const capability of TEXT_COMMIT_CAPABILITY_NAMES) {
			expect(CAPABILITIES[capability].contract, capability).toContain('Nothing is written');
		}
	});

	it('is not reachable from any page', async () => {
		// Same answer the version verbs give, and for the same reason: each of
		// these texts has an editor of its own where a person does this with a
		// button. It is also what keeps four more contracts out of the chat's
		// per-page prompt budget.
		for (const capability of TEXT_COMMIT_CAPABILITY_NAMES) {
			expect(await CAPABILITIES[capability].resolve(null, ACTOR), capability).toBeNull();
			expect(CAPABILITIES[capability].resolveMany, capability).toBeUndefined();
		}
	});

	it('recognises its own names and no others', () => {
		expect(TEXT_COMMIT_CAPABILITY_NAMES).toEqual([
			'use_letter_version',
			'use_question_version',
			'use_story_version',
			'use_cheat_sheet_version'
		]);
		expect(isTextCommitCapability('add_cheat_sheet_version')).toBe(false);
	});
});

describe('which version the text is already showing', () => {
	it('reads it off the trail the way the timeline’s badge does', async () => {
		const state = await stateFor();
		expect(state.cheat_sheet_version_id).toBe(1);
	});

	it('ignores whitespace, and only whitespace', async () => {
		committed = '  what the sheet says now\n';
		expect((await stateFor()).cheat_sheet_version_id).toBe(1);

		committed = 'what the sheet Says now';
		expect((await stateFor()).cheat_sheet_version_id).toBeNull();
	});

	it('counts a version that differs only in line endings as the live one', async () => {
		// The case this whole rule was found on: a sheet stored with CRLF and a
		// version of it written with LF are the same words, and reading them as a
		// rewrite offers a commit that changes nothing a person can see.
		committed = 'first line\r\nsecond line';
		trail = [version(4, 'first line\nsecond line')];
		expect((await stateFor()).cheat_sheet_version_id).toBe(4);
	});

	it('takes the newest of two versions holding the same words', async () => {
		// A text committed, revised and committed back has two matches, and the
		// badge in the editor sits on the later one.
		trail = [version(1, 'same words'), version(4, 'different'), version(9, 'same words')];
		committed = 'same words';
		expect((await stateFor()).cheat_sheet_version_id).toBe(9);
	});

	it('does not count an advice turn as a version', async () => {
		// A version carrying no content changed nothing. Counting it would offer
		// the agent an id that commits an empty text.
		trail = [version(1, 'what the sheet says now'), version(4, null, 'ai_advice')];
		const state = await stateFor();
		expect(state.versions).toEqual([
			{ id: 1, chars: 'what the sheet says now'.length, source: 'agent_revision', at: null }
		]);
	});
});

describe('validate', () => {
	it('refuses a text with no versions, and says which verb makes one', async () => {
		trail = [];
		const result = sheet().validate({ cheat_sheet_version_id: 4 }, await stateFor());
		expect(result).toEqual({
			ok: false,
			error: expect.stringContaining('add_cheat_sheet_version')
		});
	});

	it('refuses an id this text does not have, and lists the ones it does', async () => {
		// Ids are per text, so an id read off another cheat sheet names nothing
		// here. The list is what makes the refusal actionable.
		const result = sheet().validate({ cheat_sheet_version_id: 77 }, await stateFor());
		expect(result.ok).toBe(false);
		expect((result as { error: string }).error).toContain('1, 4');
	});

	it('refuses the version the text already says', async () => {
		// Also caught earlier by the MCP write path, which narrows a field away
		// when the row already holds its value. This is the same refusal at
		// approval time, where the applicant may have pressed the button
		// themselves while the request was waiting.
		const result = sheet().validate({ cheat_sheet_version_id: 1 }, await stateFor());
		expect(result).toEqual({ ok: false, error: expect.stringContaining('already') });
	});

	it('refuses anything that is not an id', async () => {
		const state = await stateFor();
		expect(sheet().validate({}, state).ok).toBe(false);
		expect(sheet().validate({ cheat_sheet_version_id: null }, state).ok).toBe(false);
		expect(sheet().validate({ cheat_sheet_version_id: 1.5 }, state).ok).toBe(false);
	});

	it('accepts a version in the trail that is not the live one', async () => {
		expect(sheet().validate({ cheat_sheet_version_id: 4 }, await stateFor())).toEqual({ ok: true });
	});
});

describe('what the applicant is shown', () => {
	it('renders the two texts rather than the two ids', async () => {
		// The whole reason `describeChanges` exists. Through the real
		// `describeProposalChanges`, because that is what the approval card calls
		// and a hook the registry never consults is not a feature.
		const fields = { cheat_sheet_version_id: 4 };
		const previous = await sheet().beforeImage!(SHEET, await stateFor(), ACTOR, fields);

		expect(describeProposalChanges('use_cheat_sheet_version', fields, previous)).toEqual([
			{
				field: 'content',
				label: 'Text',
				from: 'what the sheet says now',
				to: 'the new wording'
			}
		]);
	});

	it('stores both sides, because the card renders from a row and not a database', async () => {
		const previous = await sheet().beforeImage!(SHEET, await stateFor(), ACTOR, {
			cheat_sheet_version_id: 4
		});
		expect(previous).toEqual({
			text: 'what the sheet says now',
			version_text: 'the new wording',
			version_id: 4
		});
	});

	it('shows nothing where the two texts differ only in whitespace', async () => {
		trail = [version(1, 'what the sheet says now'), version(4, '  what the sheet says now  ')];
		const fields = { cheat_sheet_version_id: 4 };
		const previous = await sheet().beforeImage!(SHEET, await stateFor(), ACTOR, fields);
		expect(describeProposalChanges('use_cheat_sheet_version', fields, previous)).toEqual([]);
	});
});

describe('apply', () => {
	it('puts the version’s text on the row', async () => {
		const state = await stateFor();
		await sheet().apply(SHEET, { cheat_sheet_version_id: 4 }, state, ACTOR);

		expect(written).toEqual([
			{ kind: 'cheat_sheet', id: 62, profileId: 12, content: 'the new wording' }
		]);
	});

	it('reads the version again rather than trusting the stored id', async () => {
		// A request can sit in the table for a week. `validate` runs against a
		// fresh trail and is the real gate; this is what stops the unreachable
		// case writing an empty text over a letter on the strength of a stale id.
		const state = await stateFor();
		trail = [version(1, 'what the sheet says now')];

		await expect(sheet().apply(SHEET, { cheat_sheet_version_id: 4 }, state, ACTOR)).rejects.toThrow(
			/no longer/
		);
		expect(written).toEqual([]);
	});

	it('commits a story as the canonical STAR markdown its columns round-trip', async () => {
		// The one kind with no column to write. A version whose text has no
		// headings is not dropped — star.ts keeps it in Situation — and it has to
		// arrive at `setText` in the shape the story's own reads go out through,
		// or the committed story will never again match the version it came from.
		const story = TEXT_COMMIT_CAPABILITIES.use_story_version;
		committed = '## Situation\nthe old one';
		trail = [version(1, '## Situation\nthe old one'), version(4, 'a version with no headings')];

		const state = await story.current({ id: 5, label: 'a story' }, ACTOR);
		await story.apply({ id: 5, label: 'a story' }, { story_version_id: 4 }, state, ACTOR);

		expect(written).toEqual([
			{ kind: 'story', id: 5, profileId: 12, content: '## Situation\na version with no headings' }
		]);
	});
});

describe('revert', () => {
	it('puts back the text the row held', async () => {
		// The undo the button on the page does not have. `previous.text` is the
		// row's own content at the moment of the commit, not the newest version.
		await sheet().revert!(SHEET, { text: 'what the sheet says now' }, ACTOR);
		expect(written).toEqual([
			{ kind: 'cheat_sheet', id: 62, profileId: 12, content: 'what the sheet says now' }
		]);
	});

	it('puts back an empty text as empty', async () => {
		// A commit onto a text that was empty is a real case — it is what
		// `add_cheat_sheet` leaves behind — and its undo has to clear the row
		// rather than refuse.
		await sheet().revert!(SHEET, { text: '' }, ACTOR);
		expect(written).toEqual([{ kind: 'cheat_sheet', id: 62, profileId: 12, content: null }]);
	});

	it('refuses a log row it cannot read rather than writing the current text back', async () => {
		// Writing what is there back over itself would report a successful undo
		// and undo nothing.
		await expect(sheet().revert!(SHEET, {}, ACTOR)).rejects.toThrow(/put back/);
		expect(written).toEqual([]);
	});
});

describe('authorize', () => {
	it('refuses a text that is not this profile’s', async () => {
		// `readOwnedText` answers null for a row outside the profile and for one
		// that never existed alike, which is the rule for every id on this
		// surface: an agent may name a row, never reach one.
		committed = null;
		trail = [];
		expect(await sheet().authorize(SHEET, ACTOR)).toBe(false);
	});
});
