/**
 * Tests for `edit_directives` — the standing directives as a proposal.
 *
 * The behaviours worth pinning:
 *
 *  - a preference with a real home (a rate, which jobs they want) is refused,
 *    with the home named: Rule 1 of the plan, held at the write path because a
 *    rule that only lives in a prompt holds until the model has a bad day;
 *  - a replacement shows what it replaces on the card, which is what makes a
 *    supersede reviewable rather than an overwrite in an add's clothes;
 *  - an agent never writes one directly, however additive it looks;
 *  - the source a write came from reaches the row, and an undo is recorded as
 *    one rather than as a fresh statement.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const written: { profileId: number; patch: Record<string, unknown>; source: string }[] = [];
let live: { topic: string; statement: string }[] = [];

vi.mock('../directives', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../directives')>();
	return {
		...actual,
		loadDirectives: vi.fn(async () =>
			live.map((d, i) => ({
				id: i + 1,
				...d,
				appliesTo: ['chat'],
				statedAt: new Date('2026-09-22'),
				source: 'chat'
			}))
		),
		writeDirectives: vi.fn(
			async (profileId: number, patch: Record<string, unknown>, source: string) => {
				written.push({ profileId, patch, source });
				return { written: Object.keys(patch) };
			}
		)
	};
});

vi.mock('$lib/server/db', () => ({ db: {}, dbDirect: {} }));

const { DIRECTIVE_CAPABILITIES, directiveField } = await import('../directive-capability');
const { describeProposalChanges } = await import('../capabilities');
const def = DIRECTIVE_CAPABILITIES.edit_directives;

const ACTOR = { profileId: 3, isStaff: false };
const TARGET = { id: 3, label: 'your directives' };

beforeEach(() => {
	written.length = 0;
	live = [];
});

describe('targeting', () => {
	it('is the profile itself, from any page', async () => {
		expect(def.singleton).toBe(true);
		expect(await def.resolve({ type: 'job', id: 42 }, ACTOR)).toEqual(TARGET);
		expect(await def.resolve(null, ACTOR)).toEqual(TARGET);
	});

	it('refuses another profile, which is what an old card on a switched session would be', async () => {
		expect(await def.authorize(TARGET, ACTOR)).toBe(true);
		expect(await def.authorize({ id: 4, label: 'your directives' }, ACTOR)).toBe(false);
	});
});

describe('fields', () => {
	it('has one prefixed field per topic, plus the two it refuses', () => {
		expect(Object.keys(def.fields).sort()).toEqual(
			[
				'directive.domains',
				'directive.job_search',
				'directive.personal_details',
				'directive.positioning',
				'directive.salary',
				'directive.working_with_you',
				'directive.writing_style'
			].sort()
		);
	});

	it('names every field in the contract, so the prose and the schema cannot drift', () => {
		for (const field of Object.keys(def.fields)) expect(def.contract).toContain(`"${field}"`);
	});

	it('shows the live statement of every topic as current, null where there is none', async () => {
		live = [{ topic: 'domains', statement: 'No defence work.' }];
		const current = await def.current(TARGET, ACTOR);
		expect(current[directiveField('domains')]).toBe('No defence work.');
		expect(current[directiveField('positioning')]).toBeNull();
	});
});

describe('validate', () => {
	it('accepts a statement on a topic', () => {
		expect(def.validate({ 'directive.domains': 'No defence work.' }, {})).toEqual({ ok: true });
	});

	it('refuses a rate, naming Salary Prep', () => {
		const result = def.validate({ 'directive.salary': 'My agency rate is 90 an hour.' }, {});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('/applications/salary');
	});

	it('refuses which jobs they want, naming the capability to use instead', () => {
		const result = def.validate(
			{ 'directive.domains': 'No defence.', 'directive.job_search': 'Only contract roles.' },
			{}
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('edit_match_config');
	});

	it('refuses a change that holds no real topic', () => {
		expect(def.validate({ 'directive.salary': null }, {}).ok).toBe(false);
	});

	it('refuses an essay', () => {
		const result = def.validate({ 'directive.writing_style': 'x'.repeat(501) }, {});
		expect(result.ok).toBe(false);
	});
});

describe('the card', () => {
	it('shows what a replacement replaces', () => {
		const changes = describeProposalChanges(
			'edit_directives',
			{ 'directive.domains': 'No defence or healthcare work.' },
			{ 'directive.domains': 'No defence work.' }
		);
		expect(changes).toEqual([
			{
				field: 'directive.domains',
				label: 'Domains',
				from: 'No defence work.',
				to: 'No defence or healthcare work.'
			}
		]);
	});

	it('batches several topics into one card', () => {
		const changes = describeProposalChanges(
			'edit_directives',
			{ 'directive.domains': 'No defence.', 'directive.personal_details': 'Never my age.' },
			{ 'directive.domains': null, 'directive.personal_details': null }
		);
		expect(changes.map((c) => c.label)).toEqual(['Domains', 'Personal details']);
	});
});

describe('writing', () => {
	it('passes the surface a write came from to the row', async () => {
		await def.apply(TARGET, { 'directive.domains': 'No defence.' }, {}, ACTOR, { source: 'mcp' });
		expect(written).toEqual([{ profileId: 3, patch: { domains: 'No defence.' }, source: 'mcp' }]);
	});

	it('stops a directive on null', async () => {
		await def.apply(TARGET, { 'directive.domains': null }, {}, ACTOR, { source: 'chat' });
		expect(written[0].patch).toEqual({ domains: null });
	});

	it('undoes by writing the before-image back, recorded as an undo', async () => {
		await def.revert!(
			TARGET,
			{ 'directive.domains': 'No defence work.', 'directive.positioning': null },
			ACTOR
		);
		expect(written).toEqual([
			{
				profileId: 3,
				patch: { domains: 'No defence work.', positioning: null },
				source: 'undo'
			}
		]);
	});

	it('is always for the applicant to approve when an agent asks', () => {
		expect(def.tierFor!({ 'directive.domains': 'No defence.' }, {})).toMatchObject({ tier: 2 });
	});
});
