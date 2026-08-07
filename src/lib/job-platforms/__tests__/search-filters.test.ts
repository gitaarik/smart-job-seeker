/**
 * Tests for the experience-level bucketing and source/local filter split.
 *
 * Both source-side form filtering and local eligibility collapse the job
 * taxonomy's fine-grained levels onto the five search-filter buckets, so these
 * pin that the two stay consistent.
 */
import { describe, expect, it } from 'vitest';
import {
	expandExperienceBuckets,
	experienceLevelBuckets,
	SOURCE_APPLIED_FILTER_NAMES,
	sourceApplicableFilters,
	toExperienceBuckets
} from '../search-filters';

describe('experienceLevelBuckets', () => {
	it('maps a search-filter value_key to its own bucket', () => {
		expect(experienceLevelBuckets('senior')).toEqual(['senior']);
	});

	it('maps a stored match_config label to its bucket', () => {
		expect(experienceLevelBuckets('Entry-level')).toEqual(['entry']);
		expect(experienceLevelBuckets('Mid-level')).toEqual(['mid']);
	});

	it('collapses finer taxonomy canonicals onto buckets', () => {
		expect(experienceLevelBuckets('junior')).toEqual(['entry']);
		expect(experienceLevelBuckets('internship')).toEqual(['entry']);
		expect(experienceLevelBuckets('principal')).toEqual(['lead']);
		expect(experienceLevelBuckets('staff')).toContain('lead');
		expect(experienceLevelBuckets('director')).toEqual(['executive']);
	});

	it('is separator- and case-insensitive (mid_senior → mid)', () => {
		expect(experienceLevelBuckets('mid_senior')).toContain('mid');
		expect(experienceLevelBuckets('Mid-Senior')).toContain('mid');
	});

	it('returns [] for unknown terms', () => {
		expect(experienceLevelBuckets('wizard')).toEqual([]);
	});
});

describe('toExperienceBuckets', () => {
	it('dedupes buckets across a mixed list', () => {
		expect(toExperienceBuckets(['junior', 'entry', 'Senior']).sort()).toEqual(['entry', 'senior']);
	});
});

describe('expandExperienceBuckets', () => {
	it('includes the taxonomy terms that fall into the requested buckets', () => {
		const terms = expandExperienceBuckets(['entry']);
		// normalized terms (separators stripped)
		expect(terms).toContain('entry');
		expect(terms).toContain('junior');
		expect(terms).toContain('internship');
		expect(terms).not.toContain('senior');
	});

	it('round-trips: every expanded term buckets back into the requested set', () => {
		const buckets = ['lead'];
		for (const term of expandExperienceBuckets(buckets)) {
			expect(experienceLevelBuckets(term).some((b) => buckets.includes(b))).toBe(true);
		}
	});
});

describe('sourceApplicableFilters', () => {
	it('keeps source-applied filters and drops the local-only ones', () => {
		const out = sourceApplicableFilters({
			sort_by: 'newest',
			time_posted: 'week',
			work_location: ['remote'],
			employment_type: ['permanent'],
			hours_commitment: ['fulltime'],
			experience_level: ['senior']
		});
		expect(out).toEqual({
			sort_by: 'newest',
			time_posted: 'week',
			work_location: ['remote']
		});
	});

	it('returns an empty object when only local-only filters are present', () => {
		expect(sourceApplicableFilters({ experience_level: ['senior'] })).toEqual({});
	});

	it('source set is exactly sort_by, time_posted, work_location', () => {
		expect([...SOURCE_APPLIED_FILTER_NAMES].sort()).toEqual([
			'sort_by',
			'time_posted',
			'work_location'
		]);
	});
});
