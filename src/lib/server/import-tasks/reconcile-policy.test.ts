import { describe, expect, it } from 'vitest';
import {
	applyPreferenceFilters,
	canonFilters,
	canPromoteProposal,
	computeInputHash,
	filtersEqual,
	type InputHashSources,
	selectTopUpCandidates
} from './reconcile-policy';

const baseHashInput: InputHashSources = {
	title: 'Full-Stack Engineer',
	core_stack: 'TypeScript, SvelteKit',
	city: 'Berlin',
	region: null,
	country_code: 'DE',
	job_types: ['Full-time'],
	experience_levels: ['Senior'],
	work_location: ['Remote'],
	locations: ['Berlin'],
	remote_only: false
};

describe('canPromoteProposal', () => {
	const fresh = {
		is_active: false,
		user_paused_at: null,
		last_run: null,
		auto_disabled_at: null
	};
	const ok = { runnable: true, autoActivate: true, hasActiveSlot: true };

	it("promotes an untouched, runnable proposal when there's budget", () => {
		expect(canPromoteProposal(fresh, ok)).toBe(true);
	});

	it('never promotes an already-active task', () => {
		expect(canPromoteProposal({ ...fresh, is_active: true }, ok)).toBe(false);
	});

	it('never overrides a deliberate pause', () => {
		expect(canPromoteProposal({ ...fresh, user_paused_at: new Date(1) }, ok)).toBe(false);
	});

	it('never re-activates a proposal the user already ran', () => {
		expect(canPromoteProposal({ ...fresh, last_run: new Date(1) }, ok)).toBe(false);
	});

	it('never re-activates a task the auth-block policy switched off', () => {
		// last_run stays null when every run failed at the login wall, so this
		// is the only thing standing between that switch-off and the reconciler
		// undoing it on the next cycle.
		expect(canPromoteProposal({ ...fresh, auto_disabled_at: new Date(1) }, ok)).toBe(false);
	});

	it('requires runnability, auto-activation, and an open slot', () => {
		expect(canPromoteProposal(fresh, { ...ok, runnable: false })).toBe(false);
		expect(canPromoteProposal(fresh, { ...ok, autoActivate: false })).toBe(false);
		expect(canPromoteProposal(fresh, { ...ok, hasActiveSlot: false })).toBe(false);
	});
});

describe('canonFilters / filtersEqual', () => {
	it('is order-independent across keys and values', () => {
		const a = {
			work_location: ['remote', 'hybrid'],
			experience_level: ['senior']
		};
		const b = {
			experience_level: ['senior'],
			work_location: ['hybrid', 'remote']
		};
		expect(canonFilters(a)).toBe(canonFilters(b));
		expect(filtersEqual(a, b)).toBe(true);
	});

	it('normalizes a scalar value and a single-element array alike', () => {
		expect(filtersEqual({ sort_by: 'newest' }, { sort_by: ['newest'] })).toBe(true);
	});

	it('distinguishes genuinely different selections', () => {
		expect(
			filtersEqual(
				{ experience_level: ['senior'] },
				{
					experience_level: ['mid']
				}
			)
		).toBe(false);
		expect(filtersEqual({ a: ['x'] }, { a: ['x'], b: ['y'] })).toBe(false);
	});
});

describe('applyPreferenceFilters', () => {
	it('replaces preference-managed keys and preserves the rest', () => {
		const existing = {
			experience_level: ['senior'], // managed → replaced
			work_location: ['onsite'], // managed → replaced
			sort_by: ['newest'], // not managed → preserved
			time_posted: ['week'] // not managed → preserved
		};
		const prefs = { experience_level: ['mid'], work_location: ['remote'] };
		const out = applyPreferenceFilters(existing, prefs);
		expect(out).toEqual({
			sort_by: ['newest'],
			time_posted: ['week'],
			experience_level: ['mid'],
			work_location: ['remote']
		});
	});

	it('drops a managed key that prefs no longer include', () => {
		const out = applyPreferenceFilters(
			{
				experience_level: ['senior'],
				sort_by: 'newest'
			},
			{}
		);
		expect(out).toEqual({ sort_by: 'newest' });
	});
});

describe('selectTopUpCandidates', () => {
	const tasks = [
		{ id: 1, relevance: 'medium' as const },
		{ id: 2, relevance: 'high' as const },
		{ id: 3, relevance: 'low' as const },
		{ id: 4, relevance: 'high' as const },
		{ id: 5, relevance: 'medium' as const }
	];

	it('drops low-relevance and orders high before medium (stably)', () => {
		const out = selectTopUpCandidates(tasks, 10).map((t) => t.id);
		expect(out).toEqual([2, 4, 1, 5]); // highs first (orig order), then mediums
	});

	it('respects the slot budget', () => {
		expect(selectTopUpCandidates(tasks, 1).map((t) => t.id)).toEqual([2]);
		expect(selectTopUpCandidates(tasks, 3).map((t) => t.id)).toEqual([2, 4, 1]);
	});

	it('returns nothing when no slots remain', () => {
		expect(selectTopUpCandidates(tasks, 0)).toEqual([]);
		expect(selectTopUpCandidates(tasks, -2)).toEqual([]);
	});
});

describe('computeInputHash', () => {
	it('is deterministic for identical inputs', () => {
		expect(computeInputHash(baseHashInput)).toBe(computeInputHash(baseHashInput));
	});

	it('is independent of array order within a preference list', () => {
		const reordered = {
			...baseHashInput,
			job_types: ['Full-time'],
			experience_levels: ['Senior']
		};
		const multi = { ...baseHashInput, locations: ['Berlin', 'Amsterdam'] };
		const multiReordered = {
			...baseHashInput,
			locations: ['Amsterdam', 'Berlin']
		};
		expect(computeInputHash(reordered)).toBe(computeInputHash(baseHashInput));
		expect(computeInputHash(multi)).toBe(computeInputHash(multiReordered));
	});

	it('changes when a preference changes', () => {
		const seniorityChanged = {
			...baseHashInput,
			experience_levels: ['Mid-level']
		};
		const titleChanged = { ...baseHashInput, title: 'Backend Engineer' };
		const remoteToggled = { ...baseHashInput, remote_only: true };
		expect(computeInputHash(seniorityChanged)).not.toBe(computeInputHash(baseHashInput));
		expect(computeInputHash(titleChanged)).not.toBe(computeInputHash(baseHashInput));
		expect(computeInputHash(remoteToggled)).not.toBe(computeInputHash(baseHashInput));
	});

	it('treats null and empty-array preference lists the same', () => {
		const withNulls = {
			...baseHashInput,
			job_types: null,
			locations: null,
			experience_levels: null,
			work_location: null
		};
		const withEmpties = {
			...baseHashInput,
			job_types: [],
			locations: [],
			experience_levels: [],
			work_location: []
		};
		expect(computeInputHash(withNulls)).toBe(computeInputHash(withEmpties));
	});
});
