/**
 * Tests for touchProfile — bumps profiles.date_updated so the matcher's
 * collected_data staleness check re-exports the profile after a child-record
 * edit (skills, work experiences, interview stories, etc.).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Drizzle update chain: db.update(profiles).set({...}).where(...)
const mockWhere = vi.fn().mockResolvedValue({});
const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		update: (...a: any[]) => mockUpdate(...a)
	}
}));

vi.mock('drizzle-orm', () => ({
	// Return the compared value so the where-arg is inspectable in assertions.
	eq: vi.fn((_col: any, val: any) => val)
}));

vi.mock('$lib/server/db/schema', () => ({
	profiles: { id: 'profiles.id' }
}));

import { touchProfile } from '../touch-profile';

describe('touchProfile', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockWhere.mockResolvedValue({});
	});

	it('updates the profiles table', async () => {
		await touchProfile(42);
		expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'profiles.id' }));
	});

	it('sets date_updated to a fresh Date', async () => {
		await touchProfile(42);
		expect(mockSet).toHaveBeenCalledWith(
			expect.objectContaining({ date_updated: expect.any(Date) })
		);
	});

	it('scopes the update to the given profile id', async () => {
		await touchProfile(7);
		// Our eq() mock returns its value arg, so where() receives the profile id.
		expect(mockWhere).toHaveBeenCalledWith(7);
	});
});
