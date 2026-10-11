import { describe, expect, it } from 'vitest';
import { careerLevel, takenForGranted } from '../assumed-levels';

const now = new Date('2026-10-11');

describe('careerLevel', () => {
	it('is junior under two years, medior under five, then senior', () => {
		expect(careerLevel([{ start_date: '2025-01-01', end_date: null }], now)).toBe('junior');
		expect(careerLevel([{ start_date: '2023-06-01', end_date: null }], now)).toBe('medior');
		expect(careerLevel([{ start_date: '2021-01-01', end_date: null }], now)).toBe('senior');
	});

	it('counts two jobs at once once', () => {
		// 4.8 years of work; summed, the two current jobs would be 9.
		const roles = [
			{ start_date: '2022-01-01', end_date: null },
			{ start_date: '2022-06-01', end_date: null }
		];
		expect(careerLevel(roles, now)).toBe('medior');
	});

	it('does not count a gap', () => {
		// A year in 2010 and 1.4 years now; from the first start it would be 16.
		const roles = [
			{ start_date: '2010-01-01', end_date: '2011-01-01' },
			{ start_date: '2025-06-01', end_date: null }
		];
		expect(careerLevel(roles, now)).toBe('medior');
	});

	it('is null without a dated role, which takes nothing for granted', () => {
		expect(careerLevel([], now)).toBeNull();
		expect(careerLevel([{ start_date: null, end_date: null }], now)).toBeNull();
	});
});

describe('takenForGranted', () => {
	const levels = new Map([
		['git', { from: 'junior', for: 'software developers' }],
		['docker', { from: 'senior', for: 'software developers' }],
		['windows', { from: 'junior', for: 'everyone' }],
		['excel', { from: 'junior', for: 'office workers' }]
	]);
	const developer = (lines: readonly string[]) => (lines.includes('softwaredevelopment') ? 12 : 0);
	const sorted = (set: Set<string>) => [...set].sort();

	it('takes a skill for granted from its level up, in its line of work', () => {
		expect(sorted(takenForGranted(levels, 'senior', developer))).toEqual([
			'docker',
			'git',
			'windows'
		]);
		expect(sorted(takenForGranted(levels, 'medior', developer))).toEqual(['git', 'windows']);
	});

	it('takes nothing for granted in a line of work the profile barely touches', () => {
		// Two held skills under Software development do not make a developer.
		expect(sorted(takenForGranted(levels, 'senior', () => 2))).toEqual(['windows']);
	});

	it('applies a line of work it cannot recognise to no one', () => {
		// No concept says who does office work, and Excel is central to analysts.
		expect(takenForGranted(levels, 'senior', () => 99).has('excel')).toBe(false);
	});

	it('takes nothing for granted without a level', () => {
		expect(takenForGranted(levels, null, developer).size).toBe(0);
	});
});
