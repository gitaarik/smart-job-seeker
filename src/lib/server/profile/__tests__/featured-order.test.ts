import { describe, expect, test, vi } from 'vitest';

// Only the pure planning is under test; the writes need a database.
vi.mock('$lib/server/db', () => ({ dbDirect: {} }));

const { planFeaturedOrder } = await import('../featured-order');

/**
 * The reorder action posts a list of keys from the browser. Only the
 * profile's own featured entries may get a place, whatever else arrives.
 */
describe('planFeaturedOrder', () => {
	const featured = [{ key: 'experience-5' }, { key: 'role-10' }, { key: 'side-3' }];

	test('numbers each entry by its place, per table', () => {
		expect(planFeaturedOrder(['role-10', 'side-3', 'experience-5'], featured)).toEqual({
			roles: [{ id: 5, place: 2 }],
			roleProjects: [{ id: 10, place: 0 }],
			sideProjects: [{ id: 3, place: 1 }]
		});
	});

	test('drops a key that is not one of the profile’s featured entries, and a repeat', () => {
		expect(planFeaturedOrder(['side-99', 'side-3', 'side-3', 'role-10'], featured)).toEqual({
			roles: [],
			roleProjects: [{ id: 10, place: 1 }],
			sideProjects: [{ id: 3, place: 0 }]
		});
	});

	test('refuses what is not a list of keys', () => {
		expect(planFeaturedOrder('role-10', featured)).toBeNull();
		expect(planFeaturedOrder([10, 3], featured)).toBeNull();
	});
});
