/**
 * Tests for `normalizeWorkLocation`.
 *
 * This does double duty in the import path (cloud/src/server/scrapers/job-data.ts):
 * a location string that normalizes to a work arrangement is NOT a place, so it
 * is stripped from `office_location` — and, since that commit, used as the
 * job's `work_location` when the posting carried no explicit remote field.
 *
 * That makes the alias list load-bearing in a way it wasn't before. A missing
 * alias doesn't merely fail to normalize; it leaves a job with a garbage
 * office_location, no region, and no work arrangement — the state that made
 * half the jobs table look unclassifiable. "Worldwide" (804 rows on preview)
 * and "werk van thuis" (326) were exactly that.
 */
import { describe, expect, it } from 'vitest';
import { normalizeWorkLocation } from '../job-normalize';

describe('normalizeWorkLocation', () => {
	describe('recognises a work arrangement given as the location', () => {
		it.each([
			['Remote'],
			['remote'],
			['Fully Remote'],
			['Worldwide'],
			['wereldwijd'],
			['Anywhere'],
			['Werk van thuis'],
			['Werken van thuis'],
			['Thuiswerk'],
			['Thuiswerk in Nederland'],
			['Work from home'],
			['Homeoffice'],
			['télétravail']
		])('%s -> remote', (input) => {
			expect(normalizeWorkLocation(input)).toEqual(['remote']);
		});
	});

	// From preview's unclassified bucket. These say "remote" without leading
	// with the word, so neither the exact alias nor the startsWith rule saw
	// them, and they were being counted as unreadable places.
	describe('remote phrased without leading with the word', () => {
		it.each([
			['100% Remote'],
			['Work fully remote, globally'],
			['Home Based - Americas'],
			['Home based - EMEA'],
			['Distributed'],
			['Fully Remote (Targeting LATAM or Europe time zones for team overlap)']
		])('%s -> remote', (input) => {
			expect(normalizeWorkLocation(input)).toEqual(['remote']);
		});
	});

	describe('consultancy phrasing for on-site', () => {
		it.each([['Customer Site'], ['Client Site']])('%s -> onsite', (input) => {
			expect(normalizeWorkLocation(input)).toEqual(['onsite']);
		});
	});

	// The consequence of a false positive here is losing a real location, so
	// actual places must not normalize to anything.
	describe('leaves real places alone', () => {
		it.each([
			['Amsterdam'],
			['Nieuwegein'],
			['Austin, TX'],
			['Ramat Gan, Israel'],
			['2215 Voorhout'],
			['London, UK']
		])('%s -> null', (input) => {
			expect(normalizeWorkLocation(input)).toBeNull();
		});
	});

	it('returns null for empty input', () => {
		expect(normalizeWorkLocation(null)).toBeNull();
		expect(normalizeWorkLocation('')).toBeNull();
		expect(normalizeWorkLocation('   ')).toBeNull();
	});

	it('still reads the hybrid and onsite arrangements', () => {
		expect(normalizeWorkLocation('Hybrid')).toEqual(['hybrid']);
		expect(normalizeWorkLocation('On-site')).toEqual(['onsite']);
	});
});
