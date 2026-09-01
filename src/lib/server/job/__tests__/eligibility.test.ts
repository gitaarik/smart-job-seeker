/**
 * Tests for the SQL half of the eligibility gate.
 *
 * It had none until 2026-09-01, and that is not incidental: this file and
 * `checkEligibility` in cloud/src/server/job/matcher.ts are meant to be the
 * same gate expressed twice, the in-memory one carried tests, and the two
 * disagreed about 47% of the corpus for as long as both existed. A rule stated
 * in two places with assertions on one of them is a rule with no assertions.
 *
 * `$lib/server/db` is mocked down to the two things this module actually uses,
 * so importing it does not drag in a database connection.
 */

import { describe, expect, it, vi } from 'vitest';
import { sql as drizzleSql, type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

vi.mock('$lib/server/db', () => ({
	sql: drizzleSql,
	sqlJoin: (values: unknown[]) =>
		drizzleSql.join(
			values.map((v) => drizzleSql`${v}`),
			drizzleSql.raw(',')
		)
}));

import { buildEligibilityFilter, skillGateApplies } from '../eligibility';

const dialect = new PgDialect();

/**
 * The bound parameters of a built fragment, in order.
 *
 * Asserting on parameters rather than on rendered text: the text is whitespace
 * and comments, the parameters are the decisions. Rendered through the real
 * dialect rather than by walking `queryChunks`, because the internal node shape
 * is drizzle's business and an assertion that reads it breaks on a bump for no
 * reason.
 */
function paramsOf(fragment: SQL): unknown[] {
	return dialect.sqlToQuery(fragment).params;
}

/** The rendered fragment, whitespace collapsed, for structural assertions. */
function textOf(fragment: SQL): string {
	return dialect.sqlToQuery(fragment).sql.replace(/\s+/g, ' ');
}

const config = { work_location: ['remote'], job_types: ['fulltime'] };

describe('skillGateApplies', () => {
	it('applies only when the job carries both required and preferred skills', () => {
		expect(skillGateApplies(['Python'], ['Rust'])).toBe(true);
	});

	// The divergence itself. Every one of these returned true in the in-memory
	// twin and false here, and 2,466 of preview's 5,271 skill-carrying jobs are
	// the first case: required skills listed, no preferred ones.
	it('stands down when either list is empty', () => {
		expect(skillGateApplies(['Python'], [])).toBe(false);
		expect(skillGateApplies([], ['Python'])).toBe(false);
		expect(skillGateApplies([], [])).toBe(false);
	});

	// jsonb columns arrive as SQL NULL, JSON null, or an array. Anything that is
	// not an array is no skill data, never a crash.
	it('treats non-arrays as no skill data', () => {
		expect(skillGateApplies(null, ['Python'])).toBe(false);
		expect(skillGateApplies(['Python'], undefined)).toBe(false);
		expect(skillGateApplies('Python', 'Rust')).toBe(false);
		expect(skillGateApplies({ a: 1 }, ['Rust'])).toBe(false);
	});
});

describe('buildEligibilityFilter', () => {
	it('binds profile skills normalized, matching the in-memory comparison', () => {
		const params = paramsOf(buildEligibilityFilter(config, ['Node.js', 'CI/CD', 'C++']));
		expect(params).toContain('nodejs');
		expect(params).toContain('cicd');
		expect(params).toContain('c++');
		// The raw spellings must NOT be bound: they were, via the jsonb any-key
		// operator, and that made this side case-sensitive while the other side
		// was not.
		expect(params).not.toContain('Node.js');
		expect(params).not.toContain('CI/CD');
	});

	it('deduplicates skills that normalize to the same key', () => {
		const params = paramsOf(buildEligibilityFilter(config, ['Git Flow', 'gitflow', 'GitFlow']));
		expect(params.filter((p) => p === 'gitflow')).toHaveLength(1);
	});

	// An empty string would compare equal to every job skill that also
	// normalizes to empty, turning one junk profile row into blanket
	// eligibility.
	it('refuses a skill list that normalizes to nothing', () => {
		expect(() => buildEligibilityFilter(config, ['---', '  ', '!!'])).toThrow(/at least one skill/);
	});

	it('drops junk entries but keeps the real ones', () => {
		const params = paramsOf(buildEligibilityFilter(config, ['---', 'Python']));
		expect(params).toContain('python');
		expect(params).not.toContain('');
	});

	it('requires work location and job types', () => {
		expect(() =>
			buildEligibilityFilter({ work_location: null, job_types: ['fulltime'] }, ['python'])
		).toThrow(/Work location/);
		expect(() =>
			buildEligibilityFilter({ work_location: ['remote'], job_types: [] }, ['python'])
		).toThrow(/Job types/);
		expect(() => buildEligibilityFilter(config, [])).toThrow(/at least one skill/);
	});

	it('binds the profile id only when one is given, for the own-import escape', () => {
		expect(paramsOf(buildEligibilityFilter(config, ['python']))).not.toContain(58);
		expect(textOf(buildEligibilityFilter(config, ['python']))).not.toContain('job_importers');

		const withProfile = buildEligibilityFilter(config, ['python'], 58);
		expect(paramsOf(withProfile)).toContain(58);
		expect(textOf(withProfile)).toContain('job_importers');
	});

	// jsonb_array_length() raises on JSON null, and Postgres may evaluate an OR
	// chain in any order, so IS NULL / != 'null' branches in front of it are not
	// a guard. Only CASE is ordered. Asserting on the text because the failure
	// this prevents is a planner-dependent runtime error: it does not reproduce
	// on demand, and a rewrite back to an OR chain would look harmless.
	it('reaches jsonb_array_length only through an ordered CASE', () => {
		const text = textOf(buildEligibilityFilter(config, ['python']));
		for (const call of text.matchAll(/jsonb_array_length/g)) {
			const before = text.slice(0, call.index);
			// Every call must sit inside a CASE whose WHENs have already ruled
			// out the non-array shapes.
			expect(before.lastIndexOf('CASE')).toBeGreaterThan(before.lastIndexOf('END'));
		}
		expect(text).toContain("jsonb_typeof(j.skills_required::jsonb) IS DISTINCT FROM 'array'");
		expect(text).toContain("jsonb_typeof(j.skills_preferred::jsonb) IS DISTINCT FROM 'array'");
	});

	it('constrains experience only when the config asks for it', () => {
		const without = paramsOf(buildEligibilityFilter(config, ['python']));
		const withLevels = paramsOf(
			buildEligibilityFilter({ ...config, experience_levels: ['Senior'] }, ['python'])
		);
		expect(withLevels.length).toBeGreaterThan(without.length);
	});
});
