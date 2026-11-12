import { describe, expect, test } from 'vitest';
import { portfolioBusiness } from '../portfolio-business';
import type { PortfolioTheme } from '$lib/portfolio-themes';

const theme = (config: PortfolioTheme['config']): PortfolioTheme => ({
	id: 1,
	name: 'S',
	slug: 's',
	config
});

const row = {
	company_name: 'Jane Doe Software',
	street_address: 'Keizersgracht 1',
	postal_code: '1015 AA',
	city: 'Amsterdam',
	vat_id: 'NL001234567B01',
	kvk_number: '12345678',
	country_code: 'NL'
};

describe('portfolioBusiness', () => {
	test('prints nothing unless a showcase theme opts in', () => {
		expect(portfolioBusiness(row, null)).toBeNull();
		expect(portfolioBusiness(row, theme({ layout: 'showcase' }))).toBeNull();
		expect(portfolioBusiness(row, theme({ businessFooter: true }))).toBeNull();
	});

	test('reads the Business tab into address lines and numbers', () => {
		expect(portfolioBusiness(row, theme({ layout: 'showcase', businessFooter: true }))).toEqual({
			name: 'Jane Doe Software',
			street: 'Keizersgracht 1',
			place: '1015 AA Amsterdam',
			country: 'Netherlands',
			vatId: 'NL001234567B01',
			registration: '12345678',
			registrationLabel: 'KVK'
		});
	});

	test('prints the city and country only when the theme asks', () => {
		const shown = portfolioBusiness(
			row,
			theme({ layout: 'showcase', businessFooter: true, businessCityOnly: true })
		);
		expect(shown).toMatchObject({ street: null, place: 'Amsterdam', country: 'Netherlands' });
		expect(shown?.vatId).toBe('NL001234567B01');
	});

	test('names the registration generically outside the Netherlands', () => {
		const shown = portfolioBusiness(
			{ ...row, country_code: 'BE' },
			theme({ layout: 'showcase', businessFooter: true })
		);
		expect(shown?.registrationLabel).toBe('Registration no.');
		expect(shown?.country).toBe('Belgium');
	});

	test('is null with an empty tab, and prints no country without an address', () => {
		const on = theme({ layout: 'showcase', businessFooter: true });
		expect(portfolioBusiness({ country_code: 'NL', city: '  ' }, on)).toBeNull();
		expect(portfolioBusiness({ vat_id: 'NL1', country_code: 'NL' }, on)?.country).toBeNull();
	});
});
