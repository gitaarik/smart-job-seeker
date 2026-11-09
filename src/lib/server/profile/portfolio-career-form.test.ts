import { describe, expect, test } from 'vitest';
import type { PortfolioThemeConfig } from '$lib/portfolio-themes';
import { applyCareerFields } from './portfolio-career-form';

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [k, v] of Object.entries(fields)) data.set(k, v);
	return data;
}

describe('applyCareerFields', () => {
	test('stores a choice, as a number or the word', () => {
		const next: PortfolioThemeConfig = {};
		applyCareerFields(next, form({ briefRolesAfterYears: '15', achievementsPerRole: 'all' }));
		expect(next).toEqual({ briefRolesAfterYears: 15, achievementsPerRole: 'all' });

		applyCareerFields(next, form({ briefRolesAfterYears: 'never', achievementsPerRole: '5' }));
		expect(next).toEqual({ briefRolesAfterYears: 'never', achievementsPerRole: 5 });
	});

	test('drops a stored setting when the default is chosen again', () => {
		const next: PortfolioThemeConfig = { briefRolesAfterYears: 15, achievementsPerRole: 'all' };
		applyCareerFields(next, form({ briefRolesAfterYears: '10', achievementsPerRole: '4' }));
		expect(next).toEqual({});
	});

	test('leaves the stored settings alone when the form has no such field or names no choice', () => {
		const next: PortfolioThemeConfig = { briefRolesAfterYears: 15, achievementsPerRole: 1 };
		applyCareerFields(next, form({}));
		applyCareerFields(next, form({ briefRolesAfterYears: '7', achievementsPerRole: 'lots' }));
		expect(next).toEqual({ briefRolesAfterYears: 15, achievementsPerRole: 1 });
	});
});
