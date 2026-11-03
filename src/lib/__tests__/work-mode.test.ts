import { describe, expect, it } from 'vitest';
import { LOCALES } from '../resume-translations';
import { WORK_MODE_LABELS } from '../resume-template-labels';
import { WORK_MODES, asWorkMode, headlineWithPlace, rolePlace } from '../work-mode';

describe('work mode labels', () => {
	// The same rule as the chrome: a Dutch document must not print "Hybrid"
	// because a new locale was added to the dictionary and not to this.
	it('carry every offered locale for every mode', () => {
		for (const mode of WORK_MODES) {
			for (const { code } of LOCALES) {
				expect(WORK_MODE_LABELS[mode][code], `${mode}.${code}`).toBeTruthy();
			}
		}
	});
});

describe('asWorkMode', () => {
	it('keeps the stored words and nothing else', () => {
		expect(asWorkMode('remote')).toBe('remote');
		expect(asWorkMode('onsite')).toBe('onsite');
		expect(asWorkMode('Remote')).toBeNull();
		expect(asWorkMode('on-site')).toBeNull();
		expect(asWorkMode('')).toBeNull();
		expect(asWorkMode(null)).toBeNull();
		expect(asWorkMode(3)).toBeNull();
	});
});

describe('rolePlace', () => {
	it('prints the place, then a mode that adds something', () => {
		expect(rolePlace({ location: 'Austin, US', work_mode: 'remote' })).toBe('Austin, US · Remote');
		expect(rolePlace({ location: 'Utrecht, NL', work_mode: 'hybrid' }, 'nl')).toBe(
			'Utrecht, NL · Hybride'
		);
	});

	it('prints an on-site role, or one that has not said, as its place alone', () => {
		expect(rolePlace({ location: 'Utrecht, NL', work_mode: 'onsite' })).toBe('Utrecht, NL');
		expect(rolePlace({ location: 'Utrecht, NL', work_mode: null })).toBe('Utrecht, NL');
		expect(rolePlace({ location: 'Utrecht, NL' })).toBe('Utrecht, NL');
	});

	it('prints the mode alone without a place, and nothing for neither', () => {
		expect(rolePlace({ location: '', work_mode: 'remote' }, 'fr')).toBe('À distance');
		expect(rolePlace({ location: '  ', work_mode: 'onsite' })).toBe('');
		expect(rolePlace({ location: null, work_mode: 'somewhere' })).toBe('');
	});
});

/**
 * The lead line on a template that appends the place (Citrus). A remote role's
 * headline used to end "…reviewed by senior engineers in Austin, US (remote).",
 * which put the engineers in Austin.
 */
describe('headlineWithPlace', () => {
	const headline = 'Reviews code changes, which are then judged by senior engineers';

	it('names the employer the place belongs to on a remote role', () => {
		expect(
			headlineWithPlace(headline, { name: 'Acme', location: 'Austin, US', work_mode: 'remote' })
		).toBe(`${headline}, remote for Acme in Austin, US.`);
	});

	it('words the line in the render locale', () => {
		const role = { name: 'Acme', location: 'Austin, VS', work_mode: 'remote' };
		expect(headlineWithPlace('Reviewt codewijzigingen', role, 'nl')).toBe(
			'Reviewt codewijzigingen, remote voor Acme in Austin, VS.'
		);
		expect(headlineWithPlace('Relit le code', { ...role, location: 'Lyon, FR' }, 'fr')).toBe(
			'Relit le code, à distance pour Acme à Lyon, FR.'
		);
	});

	it('prints an office role, or one that has not said, as it always did', () => {
		const role = { name: 'Acme', location: 'Amsterdam, NL' };
		expect(headlineWithPlace('Built the ticketing platform', role)).toBe(
			'Built the ticketing platform in Amsterdam, NL.'
		);
		expect(
			headlineWithPlace('Built the ticketing platform', { ...role, work_mode: 'onsite' })
		).toBe('Built the ticketing platform in Amsterdam, NL.');
	});

	it('says hybrid after the place', () => {
		expect(
			headlineWithPlace(
				'Leidde het platformteam',
				{ name: 'Acme', location: 'Utrecht, NL', work_mode: 'hybrid' },
				'nl'
			)
		).toBe('Leidde het platformteam in Utrecht, NL (hybride).');
	});

	it('copes with a role missing its place or its employer', () => {
		expect(
			headlineWithPlace('Led the team', { name: 'Acme', location: '', work_mode: 'remote' })
		).toBe('Led the team, remote for Acme.');
		expect(
			headlineWithPlace('Led the team', { name: ' ', location: 'Austin, US', work_mode: 'remote' })
		).toBe('Led the team in Austin, US (remote).');
		expect(headlineWithPlace('Led the team', { name: 'Acme', location: null })).toBe(
			'Led the team.'
		);
	});

	it('does not print a full stop typed into the headline twice', () => {
		expect(headlineWithPlace('Led the team.', { name: 'Acme', location: 'Utrecht, NL' })).toBe(
			'Led the team in Utrecht, NL.'
		);
	});

	it('prints nothing for a role without a headline', () => {
		expect(
			headlineWithPlace('  ', { name: 'Acme', location: 'Utrecht, NL', work_mode: 'remote' })
		).toBe('');
	});
});
