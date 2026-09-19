/**
 * The three numeric fields in a diff payload, which do not arrive as numbers.
 *
 * `normalize()` in resume-diff.ts stringifies every value it puts in a `fields`
 * bag, so the modify paths hand a string to a column declared `integer()`.
 * Postgres coerced "2015" quietly and threw 22P02 on anything else — and one
 * apply writes a whole profile, so a single CV saying "expected 2026" failed the
 * entire import with a driver error that named no field.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
	educationRow: { id: 42 } as { id: number } | null,
	skillRow: { id: 7 } as { id: number } | null,
	projectRow: { id: 9 } as { id: number } | null,
	updates: [] as Record<string, unknown>[],
	inserts: [] as Record<string, unknown>[]
};

vi.mock('$lib/server/db', () => {
	const dbMock = {
		query: {
			profiles: { findFirst: () => Promise.resolve({ id: 1 }) },
			education: { findFirst: () => Promise.resolve(state.educationRow) },
			tech_skills: { findFirst: () => Promise.resolve(state.skillRow) },
			tech_skill_categories: { findFirst: () => Promise.resolve({ id: 3 }) },
			side_projects: { findFirst: () => Promise.resolve(state.projectRow) }
		},
		update: () => ({
			set: (values: Record<string, unknown>) => {
				state.updates.push(values);
				return { where: () => Promise.resolve(undefined) };
			}
		}),
		insert: () => ({
			values: (values: Record<string, unknown>) => {
				state.inserts.push(values);
				return Object.assign(Promise.resolve(undefined), {
					returning: () => Promise.resolve([{ id: 99 }])
				});
			}
		}),
		delete: () => ({ where: () => Promise.resolve(undefined) }),
		select: () => ({ from: () => ({ where: () => Promise.resolve([{ value: 0 }]) }) })
	};
	return { db: dbMock, dbDirect: dbMock };
});

const { applyDiffToProfile } = await import('../apply-diff');

/** The last value written for a column, across updates and inserts. */
function written(column: string): unknown {
	const all = [...state.updates, ...state.inserts].filter((w) => column in w);
	return all.length ? all[all.length - 1][column] : undefined;
}

beforeEach(() => {
	state.updates = [];
	state.inserts = [];
});

describe('numeric fields arriving as strings', () => {
	it('stores a stringified graduation year as a number', async () => {
		await applyDiffToProfile(1, 'user-1', {
			education: {
				modified: [{ matchKey: 'Uni|||CS', fields: { graduationYear: '2015' as never } }]
			}
		});
		expect(written('graduation_year')).toBe(2015);
	});

	it('keeps the first year of a range rather than failing the import', async () => {
		// The shape that actually turns up in CVs. Postgres rejected this
		// outright, and one rejected column aborted the whole apply.
		await applyDiffToProfile(1, 'user-1', {
			education: {
				modified: [{ matchKey: 'Uni|||CS', fields: { graduationYear: '2015-2016' as never } }]
			}
		});
		expect(written('graduation_year')).toBe(2015);
	});

	it('stores an unparseable year as null instead of throwing', async () => {
		await applyDiffToProfile(1, 'user-1', {
			education: {
				modified: [{ matchKey: 'Uni|||CS', fields: { graduationYear: 'expected 2026' as never } }]
			}
		});
		expect(written('graduation_year')).toBeNull();
	});

	it('coerces years of experience on a skill', async () => {
		await applyDiffToProfile(1, 'user-1', {
			skills: {
				modified: [
					{
						matchKey: 'Backend',
						modifySkills: [{ name: 'Python', fields: { yearsExperience: '8' as never } }]
					}
				]
			}
		});
		expect(written('years_experience')).toBe(8);
	});

	it('coerces a project star count', async () => {
		await applyDiffToProfile(1, 'user-1', {
			projects: { modified: [{ matchKey: 'sjs', fields: { stars: '120' as never } }] }
		});
		expect(written('stars')).toBe(120);
	});

	it('leaves a real number alone', async () => {
		await applyDiffToProfile(1, 'user-1', {
			education: { added: [{ institution: 'Uni', graduationYear: 2015 }] }
		});
		expect(written('graduation_year')).toBe(2015);
	});
});
