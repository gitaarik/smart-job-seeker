/**
 * Tests for the section matcher.
 *
 * Two things are worth asserting here and neither is "the happy path works":
 *
 *  - the **negatives**. A matcher that fires on everything is worse than none,
 *    because it spends the budget on every turn and offers edits nobody asked
 *    for. The words this app uses constantly — "job", "project", "achievement" —
 *    are the ones that must NOT match, and they are why the aliases in the
 *    declaration are phrases rather than nouns.
 *  - the **tiers**. Row narrowing is loose inside a named section and strict
 *    outside one, and the reason is not visible from either half alone.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

let rowsByResource: Record<string, { id: number; [key: string]: unknown }[]> = {};
const readRows = vi.fn();

vi.mock('$lib/server/profile/write', () => ({
	readOwnedRows: (name: string, actor: { profileId: number }) => {
		readRows(name, actor);
		return Promise.resolve(rowsByResource[name] ?? []);
	}
}));

import { matchProfileSections } from '../profile-matching';

const PROFILE_ID = 12;

async function match(
	message: string,
	opts: Parameters<typeof matchProfileSections>[0] | null = null
) {
	return matchProfileSections({
		messages: [message],
		profileId: PROFILE_ID,
		...(opts ?? {})
	});
}

beforeEach(() => {
	readRows.mockClear();
	// Keyed by RESOURCE name, which is what readOwnedRows takes — the table is
	// its business, not its caller's.
	rowsByResource = {
		work_experience: [
			{ id: 1, position: 'Senior Engineer', name: 'Acme Corp' },
			{ id: 2, position: 'Managing Director', name: 'Northwind' }
		],
		language: [
			{ id: 10, name: 'Dutch' },
			{ id: 11, name: 'Spanish' }
		],
		education: [{ id: 20, area: 'Computer Science', institution: 'TU Delft' }],
		certificate: [{ id: 30, name: 'Solutions Architect', issuer: 'AWS' }],
		reference: [{ id: 40, author: 'Jane Smith', author_position: 'CTO at Northwind' }],
		side_project: [{ id: 50, name: 'Tunnelvision' }],
		highlight: [{ id: 60, text: 'Shipped a scraper that runs on the applicant’s own machine' }],
		skill: [
			{ id: 70, name: 'PostgreSQL' },
			{ id: 71, name: 'Svelte' }
		],
		skill_category: [{ id: 80, name: 'Backend' }]
	};
});

describe('the declared vocabulary', () => {
	it('gives no term to two sections', async () => {
		// A word two sections both claim loads both of them, every time anyone
		// says it — and the second is always the wrong one. The failure is silent
		// and it is paid per turn, so it is worth asserting rather than reviewing.
		const { PROFILE_RESOURCE_NAMES, PROFILE_RESOURCES } =
			await import('$lib/server/profile/resources');

		// A section naming itself twice is fine and common — "Work experience" is
		// both the title and the label. What must not happen is two sections.
		//
		// Built from `title` and not `page.name` because the matcher is: skills and
		// skill categories share the Skills page, so the page's name belongs to
		// both of them and says nothing about which one a message meant.
		const owners = new Map<string, Set<string>>();
		for (const name of PROFILE_RESOURCE_NAMES) {
			const { title, label, aliases = [] } = PROFILE_RESOURCES[name];
			for (const term of [title, label, ...aliases]) {
				const key = term.toLowerCase();
				owners.set(key, (owners.get(key) ?? new Set()).add(name));
			}
		}

		const shared = [...owners.entries()].filter(([, names]) => names.size > 1);
		expect(shared.map(([term, names]) => `${term}: ${[...names].join(', ')}`)).toEqual([]);
	});
});

describe('naming a section', () => {
	it('matches the name in the navigation', async () => {
		const found = await match('can you tidy up my work experience?');
		expect(found.map((m) => m.resource)).toEqual(['work_experience']);
		expect(found[0].via).toBe('section');
	});

	it('matches an alias', async () => {
		expect((await match('my degree should say 2019')).map((m) => m.resource)).toEqual([
			'education'
		]);
		expect((await match('add a certification I just got')).map((m) => m.resource)).toEqual([
			'certificate'
		]);
	});

	it('matches the plural without it being declared', async () => {
		// Declaring both is a second place to forget one.
		expect((await match('sort out my references')).map((m) => m.resource)).toEqual(['reference']);
		expect((await match('list my certifications')).map((m) => m.resource)).toEqual(['certificate']);
	});

	it('ignores case and punctuation', async () => {
		expect((await match('My Work-Experience, please!')).map((m) => m.resource)).toEqual([
			'work_experience'
		]);
	});

	it('does not match inside a longer word', async () => {
		// The space padding is what makes this true without a regex: "degree" must
		// not fire on "degrees of freedom" — or rather, must fire on neither half
		// of a word it happens to be a prefix of.
		expect(await match('this role needs a high degreee of autonomy')).toEqual([]);
	});

	it('orders by where the message named them', async () => {
		const found = await match('fix my languages and then my education');
		expect(found.map((m) => m.resource)).toEqual(['language', 'education']);
	});
});

describe('the words this app says all the time', () => {
	// The false-positive class that matters. Each of these is a sentence someone
	// types on a job or application page several times a session, and each
	// contains a word that a naive alias list would have claimed.

	it('does not read "job" as their work history', async () => {
		expect(await match('is this job worth applying to?')).toEqual([]);
		expect(await match('rewrite the job description to be shorter')).toEqual([]);
	});

	it('does not read "project" as a side project', async () => {
		expect(await match('what projects would I work on in this role?')).toEqual([]);
	});

	it('does not read "achievement" as a highlight', async () => {
		// Highlights and a work experience's achievements are different things in
		// different places; the word belongs to neither exclusively.
		expect(await match('what achievements should I mention in the cover letter?')).toEqual([]);
	});

	it('does not match a turn that is about nothing in the profile', async () => {
		expect(await match('what do you think?')).toEqual([]);
		expect(await match('')).toEqual([]);
	});
});

describe('naming a row inside a named section', () => {
	it('narrows to the row the message named', async () => {
		const [found] = await match('fix the dates on my work experience at Acme');
		expect(found.resource).toBe('work_experience');
		expect(found.row).toEqual({ id: 1, label: 'Senior Engineer at Acme Corp' });
	});

	it('keeps the whole list when the message named two of them', async () => {
		// Not a failure — a genuine choice, and the model makes it better from the
		// list than a token count does.
		const [found] = await match('compare my work experience at Acme and Northwind');
		expect(found.row).toBeNull();
	});

	it('keeps the whole list when the message named none of them', async () => {
		const [found] = await match('my work experience needs a going-over');
		expect(found.row).toBeNull();
	});

	it('does not narrow on a word that names a section', async () => {
		// Empty rows are labelled "Untitled role", "Untitled language" and so on.
		// Without this, "add a role" would narrow to whichever unnamed row came
		// first, and the model would be handed one at random.
		rowsByResource.work_experience = [
			{ id: 1, position: '', name: '' },
			{ id: 2, position: 'Managing Director', name: 'Northwind' }
		];

		const [found] = await match('add a role to my work history');
		expect(found.row).toBeNull();
	});
});

describe('naming a row and no section', () => {
	it('finds the section from a whole row label', async () => {
		const [found] = await match('make my Spanish conversational');
		expect(found.resource).toBe('language');
		expect(found.via).toBe('row');
		expect(found.row).toEqual({ id: 11, label: 'Spanish' });
	});

	it('will not take a fragment of a label', async () => {
		// The strict tier. Nothing has established the section, so a token match
		// here would let any common word in a label reach for a capability.
		expect(await match('update my Acme entry')).toEqual([]);
	});

	it('only looks at the sections edited on their list', async () => {
		// The long-label sections would never match whole anyway, so reading them
		// costs the applicant's entire work history per turn to find nothing.
		//
		// Skills are edited on their list and are still not here: their labels are
		// the app's ordinary vocabulary, so a whole-label match on one fires on
		// turns about a job posting. They declare that themselves — see
		// `rowNamesAreAmbiguous` — rather than this file keeping a list.
		await match('some message naming nothing at all');
		expect(readRows.mock.calls.map(([name]) => name).sort()).toEqual([
			'certificate',
			'highlight',
			'language',
			'reference'
		]);
	});

	it('does not reach for skills because a message named a technology', async () => {
		// The failure this prevents: every turn spent reading a job description
		// mentions a skill by name, and matching on that would put the skills
		// capabilities — the biggest section there is — into all of them.
		rowsByResource.skill = [{ id: 70, name: 'React' }];
		expect(await match('does this job really need five years of React?')).toEqual([]);
	});
});

describe('what the page already offers', () => {
	it('does not match a section the page grants', async () => {
		// Resolving it twice would put two copies of its contract in the prompt.
		const found = await matchProfileSections({
			messages: ['fix my languages'],
			profileId: PROFILE_ID,
			exclude: ['language']
		});
		expect(found).toEqual([]);
	});
});

describe('following up', () => {
	it('inherits the section from an earlier turn', async () => {
		// "add Spanish to my languages" / "actually, make it conversational" — the
		// second names nothing and must not lose what the first earned.
		const found = await matchProfileSections({
			messages: ['add Spanish to my languages', 'actually, make it conversational'],
			profileId: PROFILE_ID
		});
		expect(found.map((m) => m.resource)).toEqual(['language']);
	});

	it('lets a newer turn take over completely', async () => {
		// Stickiness that accumulated would end up offering every section the
		// conversation had ever wandered past.
		const found = await matchProfileSections({
			messages: ['fix my languages', 'now sort out my education'],
			profileId: PROFILE_ID
		});
		expect(found.map((m) => m.resource)).toEqual(['education']);
	});

	it('reads each section at most once across the window', async () => {
		await matchProfileSections({
			messages: ['nothing here', 'nor here', 'nor in this one'],
			profileId: PROFILE_ID
		});

		const names = readRows.mock.calls.map(([name]) => name);
		expect(names.length).toBe(new Set(names).size);
	});
});
