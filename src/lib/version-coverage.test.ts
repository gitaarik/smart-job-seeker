import { describe, expect, it } from 'vitest';
import {
	carrierOf,
	carriesName,
	hiddenSkillsKey,
	recommendVersion,
	type VersionCoverage
} from './version-coverage';

function entry(shown: string[], hidden: string[], required = 8): VersionCoverage {
	return {
		shown,
		hidden: hidden.map((name, i) => ({ id: i + 1, name, liftable: true, carriedBy: null })),
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

	it('says nothing when no version beats the plain document', () => {
		// The plain document is the yardstick, never the answer: it usually cannot
		// be sent at all (the version-less URL falls back to the public version,
		// and PDF export is keyed by slug). If nothing beats it, which version you
		// send makes no difference to this job — so the card stays quiet.
		const coverage = {
			[hiddenSkillsKey('resume', '')]: entry(['React'], ['Go']),
			[hiddenSkillsKey('resume', 'frontend')]: entry(['React'], ['Go'])
		};
		expect(recommendVersion(coverage, 'resume', CANDIDATES)).toBeNull();
	});

	it('still lets a version win when it genuinely beats the baseline', () => {
		const coverage = {
			[hiddenSkillsKey('resume', '')]: entry(['React'], ['Go']),
			[hiddenSkillsKey('resume', 'backend')]: entry(['React', 'Go'], [])
		};
		expect(recommendVersion(coverage, 'resume', CANDIDATES)?.versionSlug).toBe('backend');
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

describe('carriesName', () => {
	it('reads whole words, so a compound is not the word it is built from', () => {
		expect(carriesName('SQL', 'SQL optimization')).toBe(true);
		expect(carriesName('AWS', 'AWS EC2')).toBe(true);
		expect(carriesName('Vue', 'Vue.js')).toBe(true);
		// The case the whole approach turns on: MySQL is one word, and it is not
		// the word SQL. A substring test would have said otherwise.
		expect(carriesName('SQL', 'MySQL')).toBe(false);
		expect(carriesName('SQL', 'PostgreSQL')).toBe(false);
		expect(carriesName('Git', 'GitHub Actions')).toBe(false);
	});

	it('keeps the punctuation that is part of a name', () => {
		expect(carriesName('C++', 'C++ templates')).toBe(true);
		expect(carriesName('C', 'C++')).toBe(false);
		expect(carriesName('C#', 'C# scripting')).toBe(true);
	});

	it('needs every word, adjacent and in order', () => {
		expect(carriesName('SQL Server', 'SQL')).toBe(false);
		expect(carriesName('SQL Server', 'Microsoft SQL Server 2019')).toBe(true);
		expect(carriesName('SQL Server', 'SQL on a server')).toBe(false);
	});
});

describe('carrierOf', () => {
	it('names the skill already carrying the word', () => {
		expect(carrierOf('AWS', ['Docker', 'AWS EC2', 'AWS S3'])).toBe('AWS EC2');
	});

	it('does not count the skill as carrying itself', () => {
		// A document printing SQL outright is showing it, not carrying it, and
		// the coverage map has already said so.
		expect(carrierOf('SQL', ['sql'])).toBeNull();
		expect(carrierOf('SQL', ['SQL', 'SQL optimization'])).toBe('SQL optimization');
	});

	it('is null when nothing on the page says the word', () => {
		expect(carrierOf('Linux', ['Docker', 'Terraform (IaC)', 'Linode'])).toBeNull();
	});
});
