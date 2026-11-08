import { describe, expect, it } from 'vitest';
import { newestVersions } from '../live';

describe('newestVersions', () => {
	it('follows replaces_id forward to the newest version', () => {
		const newest = newestVersions([
			{ id: 1, replacesId: null },
			{ id: 2, replacesId: 1 },
			{ id: 3, replacesId: 2 },
			{ id: 4, replacesId: null }
		]);
		expect(newest.get(1)).toBe(3);
		expect(newest.get(2)).toBe(3);
		expect(newest.get(3)).toBe(3);
		expect(newest.get(4)).toBe(4);
	});

	it('takes the later of two new versions of one item', () => {
		const newest = newestVersions([
			{ id: 1, replacesId: null },
			{ id: 5, replacesId: 1 },
			{ id: 7, replacesId: 1 }
		]);
		expect(newest.get(1)).toBe(7);
	});

	it('stops at a cycle rather than looping', () => {
		const newest = newestVersions([
			{ id: 1, replacesId: 2 },
			{ id: 2, replacesId: 1 }
		]);
		expect([1, 2]).toContain(newest.get(1));
	});
});
