import { describe, expect, it } from 'vitest';
import { hiddenSkillsKey, recommendVersion, type VersionCoverage } from './version-coverage';

function entry(shown: string[], hidden: string[], required = 8): VersionCoverage {
	return {
		shown,
		hidden: hidden.map((name, i) => ({ id: i + 1, name, liftable: true })),
		owned: shown.length + hidden.length,
		required
	};
}

// '' is the plain base document; the rest are the applicant's versions in their
// own order.
const CANDIDATES = ['', 'frontend', 'backend'];

describe('recommendVersion', () => {
	it('returns nothing when no coverage was measured', () => {
		expect(recommendVersion({}, 'resume', CANDIDATES)).toBeNull();
	});

	it('picks the version that shows the most required skills', () => {
		const coverage = {
			[hiddenSkillsKey('resume', '')]: entry(['React'], ['Kubernetes', 'Go']),
			[hiddenSkillsKey('resume', 'frontend')]: entry(['React', 'CSS'], ['Kubernetes']),
			[hiddenSkillsKey('resume', 'backend')]: entry(['Go', 'Kubernetes', 'SQL'], [])
		};
		expect(recommendVersion(coverage, 'resume', CANDIDATES)?.versionSlug).toBe('backend');
	});

	it('breaks a tie on fewest hidden', () => {
		const coverage = {
			[hiddenSkillsKey('resume', 'frontend')]: entry(['React'], ['Go', 'Kubernetes']),
			[hiddenSkillsKey('resume', 'backend')]: entry(['React'], ['Go'])
		};
		expect(recommendVersion(coverage, 'resume', CANDIDATES)?.versionSlug).toBe('backend');
	});

	it('prefers the plain document when nothing beats it', () => {
		// Ties resolve to the earliest candidate, and '' is passed first — so a
		// version is only ever recommended when it genuinely wins.
		const coverage = {
			[hiddenSkillsKey('resume', '')]: entry(['React'], ['Go']),
			[hiddenSkillsKey('resume', 'frontend')]: entry(['React'], ['Go'])
		};
		expect(recommendVersion(coverage, 'resume', CANDIDATES)?.versionSlug).toBe('');
	});

	it('stays quiet when no candidate shows a single required skill', () => {
		const coverage = {
			[hiddenSkillsKey('resume', '')]: entry([], ['Go', 'Kubernetes']),
			[hiddenSkillsKey('resume', 'frontend')]: entry([], ['Go', 'Kubernetes'])
		};
		expect(recommendVersion(coverage, 'resume', CANDIDATES)).toBeNull();
	});

	it('ranks within the chosen base template only', () => {
		// The CV shows more, but the applicant is sending a resume; flipping their
		// document type under them would be a different (and unasked) decision.
		const coverage = {
			[hiddenSkillsKey('resume', 'frontend')]: entry(['React'], ['Go']),
			[hiddenSkillsKey('cv', 'backend')]: entry(['React', 'Go'], [])
		};
		const rec = recommendVersion(coverage, 'resume', CANDIDATES);
		expect(rec?.versionSlug).toBe('frontend');
		expect(recommendVersion(coverage, 'cv', CANDIDATES)?.versionSlug).toBe('backend');
	});
});
