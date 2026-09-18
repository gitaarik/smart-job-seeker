import { describe, expect, it } from 'vitest';
import {
	buildCapabilityRecord,
	droppedForBudget,
	type CapabilityRecord
} from '../capability-record';
import type { LiveCapability } from '../capabilities';

/** The two fields the record reads; the rest of LiveCapability is irrelevant here. */
const cap = (capability: string, targets = 1): LiveCapability =>
	({
		capability,
		targets: Array.from({ length: targets }, (_, i) => ({ id: i + 1 })),
		current: null
	}) as unknown as LiveCapability;

const build = (over: Partial<Parameters<typeof buildCapabilityRecord>[0]> = {}) =>
	buildCapabilityRecord({
		subject: [cap('edit_work_experience')],
		children: [],
		matched: [],
		admitted: [cap('edit_work_experience')],
		chars: 4200,
		budgetChars: 22000,
		...over
	});

describe('buildCapabilityRecord', () => {
	it('records each capability with the tier it competed in', () => {
		const record = build({
			children: [[cap('edit_work_experience_achievement')]],
			matched: [[cap('add_language'), cap('edit_language')]],
			admitted: [
				cap('edit_work_experience'),
				cap('edit_work_experience_achievement'),
				cap('add_language'),
				cap('edit_language')
			]
		});

		expect(record.entries.map((e) => [e.capability, e.tier])).toEqual([
			['edit_work_experience', 'subject'],
			['edit_work_experience_achievement', 'child'],
			['add_language', 'matched'],
			['edit_language', 'matched']
		]);
		expect(record.entries.every((e) => e.admitted)).toBe(true);
	});

	it('marks a group the budget refused, rather than omitting it', () => {
		// The whole point. A section that matched and then lost the budget race
		// looks, from outside, exactly like one the matcher never found: both end
		// as an assistant that did not offer the edit. Only this tells them apart.
		const record = build({
			matched: [[cap('add_language'), cap('edit_language')]],
			admitted: [cap('edit_work_experience')]
		});

		expect(droppedForBudget(record).map((e) => e.capability)).toEqual([
			'add_language',
			'edit_language'
		]);
		expect(record.entries.find((e) => e.capability === 'edit_work_experience')?.admitted).toBe(
			true
		);
	});

	it("keeps the page's own capability even when everything else is dropped", () => {
		// fitMatchedCapabilities never drops the subject tier — it is what the page
		// promised — so a record showing it dropped would mean that rule broke.
		const record = build({
			children: [[cap('edit_work_experience_technology')]],
			admitted: [cap('edit_work_experience')]
		});
		expect(record.entries[0]).toMatchObject({ tier: 'subject', admitted: true });
		expect(droppedForBudget(record)).toHaveLength(1);
	});

	it('counts the rows each capability was authorized to act on', () => {
		// One on a detail page, several on a list. A capability that resolved to
		// zero rows is live but useless, and only the count says so.
		const record = build({
			subject: [cap('edit_language', 4)],
			admitted: [cap('edit_language', 4)]
		});
		expect(record.entries[0].targets).toBe(4);
	});

	it('carries the block size against the budget it was packed into', () => {
		const record = build({ chars: 16984, budgetChars: 22000 });
		expect(record).toMatchObject({ chars: 16984, budgetChars: 22000 });
	});
});

describe('droppedForBudget', () => {
	it('is empty for a turn with no record', () => {
		expect(droppedForBudget(null)).toEqual([]);
		expect(droppedForBudget(undefined)).toEqual([]);
	});

	it('is empty when everything fit', () => {
		expect(droppedForBudget(build() as CapabilityRecord)).toEqual([]);
	});
});
