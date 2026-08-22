/**
 * Tests for how much friction a write gets.
 *
 * The property being pinned is not "adds are tier 1". It is that **no
 * combination of tier and scope produces a direct Tier 2 write** — that there
 * is no cell in the table where an agent overwrites authored prose without a
 * person seeing it. Everything else here is detail; that one is the reason the
 * design exists.
 */
import { describe, expect, it } from 'vitest';
import {
	annotationsFor,
	dispositionFor,
	DIRECT_WRITE_BURST,
	isUnchanged,
	tierForWrite
} from '../tiers';
import { MCP_SCOPES } from '../keys';

const noBurst = { recentDirectWrites: 0 };

describe('tierForWrite', () => {
	it('treats an add as additive whatever the section already holds', () => {
		const decision = tierForWrite({
			capability: 'add_work_experience',
			current: { existing: ['Engineer at Acme'] },
			fields: { 'work_experience.company': 'Globex' },
			...noBurst
		});

		expect(decision.tier).toBe(1);
	});

	it('treats filling an empty field as additive', () => {
		const decision = tierForWrite({
			capability: 'edit_work_experience',
			current: { 'work_experience.summary': null },
			fields: { 'work_experience.summary': 'Led the migration.' },
			...noBurst
		});

		expect(decision.tier).toBe(1);
	});

	it('counts an empty string and an empty list as empty', () => {
		// "" is what clearing a NOT NULL column writes, and [] is what an emptied
		// array column holds. Neither is content someone would miss.
		expect(
			tierForWrite({
				capability: 'edit_work_experience',
				current: { 'work_experience.summary': '', 'work_experience.technologies': [] },
				fields: { 'work_experience.summary': 'x', 'work_experience.technologies': ['ts'] },
				...noBurst
			}).tier
		).toBe(1);
	});

	it('treats replacing existing prose as an overwrite', () => {
		const decision = tierForWrite({
			capability: 'edit_work_experience',
			current: { 'work_experience.summary': 'What they wrote themselves.' },
			fields: { 'work_experience.summary': 'What the agent prefers.' },
			...noBurst
		});

		expect(decision.tier).toBe(2);
		expect(decision.reason).toContain('work_experience.summary');
	});

	it('treats clearing a populated field as an overwrite', () => {
		// The proposed value being blank does not make the write additive — this is
		// deletion, which is the case the whole hide-not-delete design is about.
		expect(
			tierForWrite({
				capability: 'edit_work_experience',
				current: { 'work_experience.summary': 'Something.' },
				fields: { 'work_experience.summary': null },
				...noBurst
			}).tier
		).toBe(2);
	});

	it('escalates a mixed write to the level of its worst field', () => {
		// One blank filled and one paragraph replaced is not two changes to be
		// graded separately: it arrives as one call and is applied as one write.
		expect(
			tierForWrite({
				capability: 'edit_work_experience',
				current: { 'work_experience.summary': 'Theirs.', 'work_experience.location': null },
				fields: { 'work_experience.summary': 'Mine.', 'work_experience.location': 'Berlin' },
				...noBurst
			}).tier
		).toBe(2);
	});

	it('never treats a hide as additive, however empty the row', () => {
		// A hide writes tags and carries no fields, so every generic rule above
		// would read it as touching nothing.
		expect(
			tierForWrite({
				capability: 'hide_work_experience',
				current: {},
				fields: {},
				...noBurst
			}).tier
		).toBe(2);
	});

	describe('a capability that grades its own write', () => {
		// `status` is notNull with a default, so the overwrite rule below would
		// grade every move through the pipeline Tier 2 — putting "they invited me
		// to a second interview" behind the same approval as rewriting a summary.
		// `CapabilityDef.tierFor` is the correction, and what it decides is the
		// point of the feature, so it is pinned here rather than in the registry.
		const APPLYING = {
			status: 'applying',
			status_step: 'Applied through job platform',
			status_action: 'Awaiting response',
			status_action_date: null
		};

		const move = (status: string, recentDirectWrites = 0) =>
			tierForWrite({
				capability: 'update_application_status',
				current: APPLYING,
				fields: { status },
				recentDirectWrites
			});

		it('writes a move that leaves the application live', () => {
			// Undone with one click and visible the moment it lands, which is what
			// Tier 1 says its protection is.
			expect(move('interviewing').tier).toBe(1);
			expect(move('negotiating').tier).toBe(1);
		});

		it('asks before closing one', () => {
			// Each of these takes it off the board the applicant works from, and
			// each is a claim about a decision somebody else made.
			for (const status of ['accepted', 'rejected', 'withdrawn']) {
				const decision = move(status);
				expect(decision.tier, status).toBe(2);
				expect(decision.reason, status).toContain('closes it');
			}
		});

		it('cannot lift the burst ceiling', () => {
			// A capability may say its own write is cheap. It may not say that the
			// twenty-first one in an hour still is — which is why the hook is asked
			// below that check and not above it.
			expect(move('interviewing', DIRECT_WRITE_BURST).tier).toBe(2);
		});
	});

	it('sends writes for approval once an agent has made too many in an hour', () => {
		// The only enforceable reading of "anything bulk": a single call is one
		// capability on one row, so bulk is never visible inside one.
		const decision = tierForWrite({
			capability: 'add_language',
			current: { existing: [] },
			fields: { 'language.name': 'Spanish' },
			recentDirectWrites: DIRECT_WRITE_BURST
		});

		expect(decision.tier).toBe(2);
		expect(decision.reason).toContain('approval');
	});

	it('still allows the last write under the limit', () => {
		expect(
			tierForWrite({
				capability: 'add_language',
				current: { existing: [] },
				fields: { 'language.name': 'Spanish' },
				recentDirectWrites: DIRECT_WRITE_BURST - 1
			}).tier
		).toBe(1);
	});
});

describe('dispositionFor', () => {
	it('never lets any scope write a tier 2 change directly', () => {
		// The invariant. If this fails, an agent that has been talked into
		// something can act on it with nobody looking, and every other protection
		// here is decoration.
		for (const scope of MCP_SCOPES) {
			expect(dispositionFor(2, scope)).not.toBe('direct');
		}
	});

	it('lets a read-only key read and nothing else', () => {
		expect(dispositionFor(0, 'read')).toBe('direct');
		expect(dispositionFor(1, 'read')).toBe('refused');
		expect(dispositionFor(2, 'read')).toBe('refused');
	});

	it('makes a propose key ask even for an additive change', () => {
		expect(dispositionFor(1, 'propose')).toBe('request');
	});

	it('lets a write key add without asking', () => {
		// Deliberate: if adding a skill needs a click, people raise the scope to
		// make the annoyance stop, and a graded system becomes an ungraded one.
		expect(dispositionFor(1, 'write')).toBe('direct');
	});

	it('lets every scope read', () => {
		for (const scope of MCP_SCOPES) {
			expect(dispositionFor(0, scope)).toBe('direct');
		}
	});
});

describe('annotationsFor', () => {
	it('marks an edit destructive and an add not', () => {
		expect(annotationsFor('edit_work_experience').destructiveHint).toBe(true);
		expect(annotationsFor('add_work_experience').destructiveHint).toBe(false);
	});

	it('marks an add non-idempotent', () => {
		// Repeating it makes a second entry, which is the duplicate the contract
		// warns about; repeating an edit lands the same values.
		expect(annotationsFor('add_language').idempotentHint).toBe(false);
		expect(annotationsFor('edit_language').idempotentHint).toBe(true);
	});

	it('never claims a write tool is read-only', () => {
		expect(annotationsFor('edit_work_experience').readOnlyHint).toBe(false);
	});

	it('annotates an edit destructive even though a given call may not be', () => {
		// tools/list is rendered before anyone has named a row, so the values that
		// decide the real tier cannot be read yet. "May be" is the honest answer to
		// a question asked that early — and these are hints to a client we do not
		// control either way.
		expect(annotationsFor('edit_language').destructiveHint).toBe(true);
	});
});

describe('isUnchanged', () => {
	it('sees through the two spellings of a date', () => {
		// A timestamp column reads back as a Date; the tool schema takes
		// "YYYY-MM-DD". Comparing them raw makes every date a change forever.
		expect(isUnchanged(new Date('2026-08-20T00:00:00.000Z'), '2026-08-20')).toBe(true);
		expect(isUnchanged(new Date('2026-08-20T00:00:00.000Z'), '2026-08-21')).toBe(false);
	});

	it('compares a skill list by its contents, in order', () => {
		// Both job skill lists are replaced whole, so a re-send arrives as a new
		// array that is equal to the old one and identical to nothing.
		expect(isUnchanged(['Python', 'SQL'], ['Python', 'SQL'])).toBe(true);
		expect(isUnchanged(['Python', 'SQL'], ['SQL', 'Python'])).toBe(false);
		expect(isUnchanged(['Python'], ['Python', 'SQL'])).toBe(false);
		expect(isUnchanged(['Python'], 'Python')).toBe(false);
	});

	it('counts clearing a field as a change', () => {
		// Strict about blanks on purpose. Folding null and "" together would make
		// "empty this" look like a no-op and drop it, which is a write the caller
		// asked for and did not get — the one failure mode worse than a redundant
		// proposal.
		expect(isUnchanged('something', null)).toBe(false);
		expect(isUnchanged(null, '')).toBe(false);
		expect(isUnchanged(null, null)).toBe(true);
	});
});
