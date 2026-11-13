/**
 * The place picker's ranking (planning/STRUCTURED-LOCATIONS.md, Phase 1), on
 * candidates as the gazetteer holds them on dev: the names folded, the own
 * name first, populations from GeoNames.
 */
import { describe, expect, it } from 'vitest';
import {
	foldPlaceName,
	type Place,
	type PlaceCandidate,
	type PlaceKind,
	placeTsQuery,
	preferredLocationTexts,
	rankPlaces
} from '../places';

let nextId = 1;
function candidate(
	kind: PlaceKind,
	label: string,
	population: number,
	alternates: string[] = []
): PlaceCandidate {
	const name = label.split(', ')[0];
	const place: Place = {
		id: nextId++,
		kind,
		name,
		label,
		country: kind === 'region' ? null : 'XX',
		countries: [],
		lat: null,
		lon: null
	};
	return { place, names: [name, ...alternates].map(foldPlaceName), population };
}

const labels = (q: string, candidates: PlaceCandidate[], limit = 8) =>
	rankPlaces(q, candidates, limit).map((p) => p.label);

describe('foldPlaceName', () => {
	it('drops case, accents and punctuation', () => {
		expect(foldPlaceName("'s-Gravenhage")).toBe('s gravenhage');
		expect(foldPlaceName('Zürich')).toBe('zurich');
		expect(foldPlaceName('  São Paulo ')).toBe('sao paulo');
		expect(foldPlaceName('Noord-Holland')).toBe('noord holland');
	});
});

describe('placeTsQuery', () => {
	it('makes every typed word a prefix', () => {
		expect(placeTsQuery('San Fr')).toBe('san:* & fr:*');
		expect(placeTsQuery('den-haag')).toBe('den:* & haag:*');
	});

	it('leaves nothing of tsquery syntax, and nothing for an empty query', () => {
		expect(placeTsQuery("a' | !b & (c:*)")).toBe('a:* & b:* & c:*');
		expect(placeTsQuery(' -!- ')).toBeNull();
		expect(placeTsQuery('')).toBeNull();
	});
});

describe('rankPlaces', () => {
	it('"ne" offers the Netherlands before Nesodden', () => {
		const result = labels('ne', [
			candidate('city', 'Nesodden, Viken, Norway', 19_000),
			candidate('city', 'Neuss, North Rhine-Westphalia, Germany', 152_000),
			candidate('country', 'Netherlands', 17_231_000, ['the netherlands', 'nederland']),
			candidate('country', 'Nepal', 28_608_000)
		]);
		expect(result.indexOf('Netherlands')).toBeLessThan(result.indexOf('Nesodden, Viken, Norway'));
		expect(result.slice(0, 2)).toEqual(['Nepal', 'Netherlands']);
	});

	it('"haar" offers Haarlem, after the town named exactly that', () => {
		expect(
			labels('haar', [
				candidate('city', 'Haarlemmerliede, North Holland, Netherlands', 5_800),
				candidate('city', 'Haarlem, North Holland, Netherlands', 162_543, ['harlem']),
				candidate('city', 'Haar, Bavaria, Germany', 21_000),
				// a word later in a name only: "Neustadt an der Haardt"
				candidate('city', 'Neustadt an der Weinstraße, Rheinland-Pfalz, Germany', 53_000, [
					'neustadt an der haardt'
				])
			])
		).toEqual([
			'Haar, Bavaria, Germany',
			'Haarlem, North Holland, Netherlands',
			'Haarlemmerliede, North Holland, Netherlands',
			'Neustadt an der Weinstraße, Rheinland-Pfalz, Germany'
		]);
	});

	it('"georgia" offers the country and the US state', () => {
		const result = labels(
			'georgia',
			[
				candidate('city', 'Savannah, Georgia, United States', 147_000),
				candidate('country', 'Georgia', 3_935_766, ['georgie', 'georgien']),
				candidate('city', 'Georgiyevsk, Stavropol Krai, Russia', 66_000),
				candidate('admin', 'Georgia, United States', 4_301_434)
			],
			2
		);
		expect(result).toHaveLength(2);
		expect(result).toContain('Georgia');
		expect(result).toContain('Georgia, United States');
	});

	it('reads a name in another language and a short name as the place', () => {
		const candidates = [
			candidate('city', 'Holland, Michigan, United States', 33_000),
			candidate('country', 'Netherlands', 17_231_000, ['nederland', 'holland']),
			candidate('city', 'The Hague, South Holland, Netherlands', 474_000, ['den haag']),
			candidate('country', 'United Kingdom', 66_488_991, ['uk', 'britain']),
			candidate('country', 'Ukraine', 44_622_516)
		];
		expect(labels('holland', candidates)[0]).toBe('Netherlands');
		expect(labels('den haag', candidates)[0]).toBe('The Hague, South Holland, Netherlands');
		expect(labels('uk', candidates)[0]).toBe('United Kingdom');
	});

	it('puts a country before a region and a city of the same size and match', () => {
		expect(
			labels('x', [
				candidate('city', 'X City', 100),
				candidate('region', 'X Region', 100),
				candidate('country', 'X Country', 100)
			])
		).toEqual(['X Country', 'X Region', 'X City']);
	});
});

describe('preferredLocationTexts', () => {
	const portugal = candidate('country', 'Portugal', 10_000_000).place;
	const europe = candidate('region', 'Europe', 700_000_000).place;

	it('gives each place by its label, then the texts not read as a place', () => {
		expect(preferredLocationTexts([portugal, europe], ['Bay Area hybrid'])).toEqual([
			'Portugal',
			'Europe',
			'Bay Area hybrid'
		]);
	});

	it('reads the texts alone before anything was picked, and nothing as nothing', () => {
		expect(preferredLocationTexts(null, ['portugal', ' ', 'europe'])).toEqual([
			'portugal',
			'europe'
		]);
		expect(preferredLocationTexts(undefined, null)).toEqual([]);
	});
});
