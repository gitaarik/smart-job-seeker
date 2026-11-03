import { describe, expect, it } from 'vitest';
import { liftWorkMode, splitWorkMode } from '../work-mode-from-location';

/**
 * A CV can only say a role was remote inside its location. Read in as the
 * location, the arrangement prints back as a place.
 */
describe('splitWorkMode', () => {
	it('reads a location that is only an arrangement', () => {
		expect(splitWorkMode('Remote')).toEqual({ location: '', workMode: 'remote' });
		expect(splitWorkMode('Fully remote')).toEqual({ location: '', workMode: 'remote' });
		expect(splitWorkMode('Hybride')).toEqual({ location: '', workMode: 'hybrid' });
		expect(splitWorkMode('On-site')).toEqual({ location: '', workMode: 'onsite' });
	});

	it('takes the place from either side of a bracket', () => {
		expect(splitWorkMode('Remote (Austin, USA)')).toEqual({
			location: 'Austin, USA',
			workMode: 'remote'
		});
		expect(splitWorkMode('Austin, USA (remote)')).toEqual({
			location: 'Austin, USA',
			workMode: 'remote'
		});
		expect(splitWorkMode('Utrecht [hybrid]')).toEqual({ location: 'Utrecht', workMode: 'hybrid' });
	});

	it('drops the arrangement from a separated list and keeps the rest joined', () => {
		expect(splitWorkMode('Remote - Austin, USA')).toEqual({
			location: 'Austin, USA',
			workMode: 'remote'
		});
		expect(splitWorkMode('Amsterdam, NL · Remote')).toEqual({
			location: 'Amsterdam, NL',
			workMode: 'remote'
		});
		expect(splitWorkMode('Amsterdam / hybrid')).toEqual({
			location: 'Amsterdam',
			workMode: 'hybrid'
		});
		expect(splitWorkMode('Thuiswerk, Nederland')).toEqual({
			location: 'Nederland',
			workMode: 'remote'
		});
	});

	it('leaves a place alone, brackets and dashes included', () => {
		expect(splitWorkMode('Amsterdam, NL')).toEqual({ location: 'Amsterdam, NL' });
		expect(splitWorkMode('Remoteville, OR')).toEqual({ location: 'Remoteville, OR' });
		expect(splitWorkMode('Leiden (Zuid-Holland)')).toEqual({ location: 'Leiden (Zuid-Holland)' });
		expect(splitWorkMode('Alphen aan den Rijn - Noord-Holland')).toEqual({
			location: 'Alphen aan den Rijn - Noord-Holland'
		});
		expect(splitWorkMode('')).toEqual({ location: '' });
		expect(splitWorkMode(null)).toEqual({ location: '' });
	});
});

describe('liftWorkMode', () => {
	it('moves the arrangement off a parsed role', () => {
		expect(liftWorkMode({ name: 'Acme', location: 'Remote (Austin, USA)' })).toEqual({
			name: 'Acme',
			location: 'Austin, USA',
			workMode: 'remote'
		});
	});

	it('returns a role with nothing to lift as it was', () => {
		const office = { name: 'Acme', location: 'Amsterdam, NL' };
		expect(liftWorkMode(office)).toBe(office);
		const unplaced: { name: string; location?: string } = { name: 'Acme' };
		expect(liftWorkMode(unplaced)).toBe(unplaced);
		const said = { name: 'Acme', location: 'Remote', workMode: 'hybrid' as const };
		expect(liftWorkMode(said)).toBe(said);
	});
});
