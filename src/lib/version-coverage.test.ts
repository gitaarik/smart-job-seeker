import { describe, expect, it } from 'vitest';
import {
	carrierOf,
	carriesName,
	carriesNameLoosely,
	hiddenSkillsKey,
	mentions,
	recommendBase,
	specWarning,
	type VersionCoverage,
	wordRoot
} from './version-coverage';

/** `hidden` as [name, liftable] — unliftable is the half that ranks a base. */
function entry(shown: string[], hidden: Array<[string, boolean]>, required = 8): VersionCoverage {
	return {
		shown,
		hidden: hidden.map(([name, liftable], i) => ({ id: i + 1, name, liftable, carriedBy: null })),
		carried: {},
		owned: shown.length + hidden.length,
		required
	};
}

// The plain document is deliberately absent: it is a candidate for "which
// version should I send", never for what to build one ON.
const CANDIDATES = ['frontend', 'backend'];

describe('recommendBase', () => {
	it('returns nothing when nothing was measured', () => {
		expect(recommendBase('resume', CANDIDATES, { outOfReach: {}, coverage: {} })).toBeNull();
	});

	it('returns nothing when there are no versions', () => {
		expect(recommendBase('resume', [], { outOfReach: {}, coverage: {} })).toBeNull();
	});

	it('picks the version that strands the least relevant evidence', () => {
		const outOfReach = {
			[hiddenSkillsKey('resume', 'frontend')]: 4,
			[hiddenSkillsKey('resume', 'backend')]: 1
		};
		const choice = recommendBase('resume', CANDIDATES, { outOfReach, coverage: {} });
		expect(choice?.versionSlug).toBe('backend');
		expect(choice?.outOfReach).toBe(1);
		expect(choice?.decidedBy).toBe('evidence');
	});

	it('reads a missing entry as nothing stranded', () => {
		// Only documents that strand something get a key, so absence is an answer
		// and not a gap: the version nobody measured a loss for is the winner.
		const outOfReach = { [hiddenSkillsKey('resume', 'frontend')]: 2 };
		expect(recommendBase('resume', CANDIDATES, { outOfReach, coverage: {} })?.versionSlug).toBe(
			'backend'
		);
	});

	it('breaks a tie on required skills held in a group the document omits', () => {
		const coverage = {
			[hiddenSkillsKey('resume', 'frontend')]: entry(['React'], [['Go', false]]),
			[hiddenSkillsKey('resume', 'backend')]: entry(['React'], [['Go', true]])
		};
		const choice = recommendBase('resume', CANDIDATES, { outOfReach: {}, coverage });
		expect(choice?.versionSlug).toBe('backend');
		expect(choice?.decidedBy).toBe('skills');
	});

	it('counts a liftable hidden skill as in reach', () => {
		// Tailoring lifts a skill whose own tag holds it back. Only a hidden
		// group or a base-template rule puts one beyond it, so a version hiding
		// three liftable skills is not thereby a worse base than one hiding none.
		const coverage = {
			[hiddenSkillsKey('resume', 'frontend')]: entry(
				[],
				[
					['Go', true],
					['Rust', true]
				]
			),
			[hiddenSkillsKey('resume', 'backend')]: entry(['React'], [])
		};
		expect(recommendBase('resume', CANDIDATES, { outOfReach: {}, coverage })).toBeNull();
	});

	it('says nothing when the versions are equally reachable', () => {
		// The common case now that the base decides no content: with the same
		// roles and groups in reach, every base produces the same document, and
		// naming one "the closest" would be a reason invented after the fact.
		const outOfReach = {
			[hiddenSkillsKey('resume', 'frontend')]: 2,
			[hiddenSkillsKey('resume', 'backend')]: 2
		};
		expect(recommendBase('resume', CANDIDATES, { outOfReach, coverage: {} })).toBeNull();
	});

	it('says nothing when several versions share the best score', () => {
		// The case real data hit: six versions tied at nothing out of reach and a
		// seventh held one required skill in a group it omits. Announcing the
		// first of the six would be a reason true of all six, and it would
		// override the version the applicant actually sends.
		const outOfReach = {
			[hiddenSkillsKey('resume', 'frontend')]: 0,
			[hiddenSkillsKey('resume', 'backend')]: 0,
			[hiddenSkillsKey('resume', 'legacy')]: 3
		};
		expect(
			recommendBase('resume', [...CANDIDATES, 'legacy'], { outOfReach, coverage: {} })
		).toBeNull();
	});

	it('never ranks on coverage — the thing a base no longer decides', () => {
		// A required skill the applicant has is pinned onto whatever this starts
		// from, so showing more of them says nothing about the finished document.
		const coverage = {
			[hiddenSkillsKey('resume', 'frontend')]: entry(['React'], []),
			[hiddenSkillsKey('resume', 'backend')]: entry(['React', 'Go', 'SQL'], [])
		};
		expect(recommendBase('resume', CANDIDATES, { outOfReach: {}, coverage })).toBeNull();
	});

	it('ranks within the chosen base template only', () => {
		const outOfReach = {
			[hiddenSkillsKey('resume', 'frontend')]: 3,
			[hiddenSkillsKey('cv', 'backend')]: 3
		};
		// On the resume, frontend is the one stranding work; on the CV, backend.
		expect(recommendBase('resume', CANDIDATES, { outOfReach, coverage: {} })?.versionSlug).toBe(
			'backend'
		);
		expect(recommendBase('cv', CANDIDATES, { outOfReach, coverage: {} })?.versionSlug).toBe(
			'frontend'
		);
	});
});

describe('wordRoot', () => {
	it('meets the forms a resume line and a skill list write one word in', () => {
		expect(['mentoring', 'mentored', 'mentor', 'mentors'].map(wordRoot)).toEqual(
			Array(4).fill('mentor')
		);
		expect(wordRoot('database')).toBe(wordRoot('databases'));
		expect(wordRoot('process')).toBe(wordRoot('processes'));
		expect(wordRoot('service')).toBe(wordRoot('services'));
	});

	it('leaves short words as they are', () => {
		expect(['led', 'uses', 'aws', 'api', 'line'].map(wordRoot)).toEqual([
			'led',
			'uses',
			'aws',
			'api',
			'line'
		]);
	});
});

describe('carriesNameLoosely', () => {
	it('finds a skill named in another form of the word', () => {
		// Application 92: the posting lists Mentoring as a plus, and the line
		// that says so says "Mentored".
		expect(carriesNameLoosely('Mentoring', 'Mentored junior & medior devs')).toBe(true);
		expect(carriesNameLoosely('Testing', 'tested every release')).toBe(true);
	});

	it('still reads whole words', () => {
		expect(carriesNameLoosely('SQL', 'MySQL')).toBe(false);
		expect(carriesNameLoosely('Git', 'GitHub Actions')).toBe(false);
		expect(carriesNameLoosely('SQL', 'SQL optimization')).toBe(true);
	});
});

describe('mentions', () => {
	it('reads a posting the way a reader does', () => {
		expect(mentions('Je bouwt de hele keten. Van database tot scherm.', 'Databases')).toBe(true);
		// A compound written as two words in one place and one in the other.
		expect(mentions('in [front-end- en back-endstack]', 'Frontend')).toBe(true);
		expect(mentions('a modern frontend team', 'Front end')).toBe(true);
	});

	it('does not find what the posting does not say', () => {
		expect(mentions('pipelines and paved roads in Azure DevOps', 'Databases')).toBe(false);
		expect(mentions('we use MySQL', 'SQL')).toBe(false);
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

describe('specWarning', () => {
	it('flags a job with no required skills at all', () => {
		expect(specWarning([], 0)?.kind).toBe('empty');
		expect(specWarning(null, 4000)?.kind).toBe('empty');
		// Whitespace and non-strings are not skills; an LLM that returns [""] has
		// returned nothing.
		expect(specWarning(['', '   '], 3000)?.kind).toBe('empty');
	});

	it('flags a handful of skills read out of a long description', () => {
		// The real case: 3 skills against 5,720 characters.
		expect(specWarning(['Python', 'PHP', 'AWS Redshift'], 5720)?.kind).toBe('thin');
	});

	it('stays quiet when the description is short too', () => {
		// A terse posting genuinely has little to extract, and warning about it
		// would fire on every recruiter one-liner.
		expect(specWarning(['Python', 'PHP'], 200)).toBeNull();
	});

	it('stays quiet on a list long enough to tailor against', () => {
		expect(specWarning(['Python', 'SQL', 'Docker', 'AWS', 'Git'], 6000)).toBeNull();
	});

	it('says how many it found, so the number is checkable', () => {
		expect(specWarning(['Python'], 4000)?.message).toContain('1 required skill ');
		expect(specWarning(['Python', 'SQL'], 4000)?.message).toContain('2 required skills');
	});
});
