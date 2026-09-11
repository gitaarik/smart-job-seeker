import { beforeEach, describe, expect, it, vi } from 'vitest';

// The provider reuses the shipped project↔job retriever; mock it so these tests
// exercise the provider's own logic (registry, budgeting, variable wiring)
// without a DB or an embedding call.
vi.mock('$lib/server/documents/retrieval', () => ({
	relevantProjectsBlock: vi.fn()
}));
vi.mock('$lib/server/documents/content-retrieval', () => ({
	relevantStoriesBlock: vi.fn(),
	relevantApplicationTextsBlock: vi.fn()
}));
// The scoped sources each load their own entity; mock the loaders so these
// tests exercise the registry and budgeting, not the DB.
vi.mock('../application-activity', () => ({ applicationActivityText: vi.fn() }));
vi.mock('../job-context', () => ({ jobDetailsText: vi.fn() }));
// Only the DB read is mocked — the trimmer and renderer are pure, so the tests
// exercise the real ones.
vi.mock('../profile-data', async (importOriginal) => ({
	...(await importOriginal<typeof import('../profile-data')>()),
	loadProfileData: vi.fn()
}));

import { relevantProjectsBlock } from '$lib/server/documents/retrieval';
import {
	relevantApplicationTextsBlock,
	relevantStoriesBlock
} from '$lib/server/documents/content-retrieval';
import { applicationActivityText } from '../application-activity';
import { jobDetailsText } from '../job-context';
import { loadProfileData } from '../profile-data';
import { assembleGenerationContext, fitToBudget, queryToJobLike } from '../generation-context';
import {
	QUERY_CLIP_CHARS,
	type RankerKind,
	type RetrievalItem
} from '$lib/server/documents/retrieval-record';

const mockRelevantProjects = vi.mocked(relevantProjectsBlock);
const mockRelevantStories = vi.mocked(relevantStoriesBlock);
const mockRelevantAppTexts = vi.mocked(relevantApplicationTextsBlock);
const mockActivity = vi.mocked(applicationActivityText);
const mockJobDetails = vi.mocked(jobDetailsText);
const mockLoadProfile = vi.mocked(loadProfileData);

/**
 * A ranked source's return: the block plus the record of what it cited. Most of
 * these tests only care about the text, so `items` defaults to empty — the
 * record itself is covered by the retrieval-record describe below.
 */
const blk = (text: string, items: RetrievalItem[] = [], ranker: RankerKind = 'semantic') => ({
	text,
	items,
	ranker
});

beforeEach(() => {
	mockRelevantProjects.mockReset();
	mockRelevantStories.mockReset();
	mockRelevantAppTexts.mockReset();
	mockActivity.mockReset().mockResolvedValue('');
	mockJobDetails.mockReset().mockResolvedValue('');
	mockLoadProfile.mockReset().mockResolvedValue({ data: {}, schema: {} });
});

describe('fitToBudget', () => {
	const block = (source: string, priority: number, len: number) => ({
		source: source as 'projects',
		priority,
		text: 'x'.repeat(len)
	});

	it('keeps every block when the total fits', () => {
		const blocks = [block('projects', 10, 100), block('projects', 5, 100)];
		expect(fitToBudget(blocks, 1000)).toHaveLength(2);
	});

	it('drops whitespace-only and empty blocks', () => {
		const blocks = [
			{ source: 'projects' as const, priority: 10, text: 'real' },
			{ source: 'projects' as const, priority: 5, text: '   \n ' }
		];
		const kept = fitToBudget(blocks, 1000);
		expect(kept).toHaveLength(1);
		expect(kept[0].text).toBe('real');
	});

	it('drops the lowest-priority block first when over budget', () => {
		const hi = block('projects', 20, 80);
		const lo = block('projects', 1, 80);
		const kept = fitToBudget([lo, hi], 100); // only one 80-char block fits
		expect(kept).toHaveLength(1);
		expect(kept[0].priority).toBe(20); // the high-priority one survived
	});

	it('keeps the single highest-priority block even if it alone exceeds budget', () => {
		const kept = fitToBudget([block('projects', 10, 5000)], 100);
		expect(kept).toHaveLength(1);
	});
});

describe('assembleGenerationContext', () => {
	it('gives every requested source a variable key even when it renders nothing', async () => {
		// The key must exist either way — an unsupplied placeholder ships to the
		// model as the literal "${relevantProjects}". Here the retrieval did run
		// and came back empty, so the key carries the "we looked, there is none"
		// note; a source that never looked gets "" (covered below).
		mockRelevantProjects.mockResolvedValue(blk(''));
		const ctx = await assembleGenerationContext({
			profileId: 1,
			query: { text: 'gardening' },
			sources: ['projects']
		});
		expect(ctx.variables).toHaveProperty('relevantProjects');
		expect(ctx.variables.relevantProjects).toContain('nothing here');
		expect(ctx.usedSources).toEqual([]);
	});

	it('fills the variable and reports the source when retrieval returns content', async () => {
		mockRelevantProjects.mockResolvedValue(blk('## Relevant projects\n1. Foo'));
		const ctx = await assembleGenerationContext({
			profileId: 1,
			query: { text: 'backend scaling', skills: ['Go'] },
			sources: ['projects']
		});
		expect(ctx.variables.relevantProjects).toContain('Relevant projects');
		expect(ctx.usedSources).toEqual(['projects']);
		// The query was adapted to the retriever's JobLike shape.
		expect(mockRelevantProjects).toHaveBeenCalledWith(
			1,
			expect.objectContaining({
				job_description: 'backend scaling',
				skills_required: ['Go']
			}),
			3,
			undefined
		);
	});

	it('skips retrieval entirely for an empty query (cost gate) and still supplies the key', async () => {
		const ctx = await assembleGenerationContext({
			profileId: 1,
			query: { text: '   ' },
			sources: ['projects']
		});
		expect(mockRelevantProjects).not.toHaveBeenCalled();
		expect(ctx.variables.relevantProjects).toBe('');
		expect(ctx.usedSources).toEqual([]);
	});

	it('honours a per-call k for the retrieval source', async () => {
		mockRelevantProjects.mockResolvedValue(blk('blk'));
		await assembleGenerationContext({
			profileId: 7,
			query: { text: 'topic' },
			sources: ['projects'],
			perSourceK: 5
		});
		expect(mockRelevantProjects).toHaveBeenCalledWith(7, expect.anything(), 5, undefined);
	});

	it('passes a pinned project through to the retriever', async () => {
		mockRelevantProjects.mockResolvedValue(blk('## Relevant projects\n1. Foo — THE SUBJECT'));
		const ctx = await assembleGenerationContext({
			profileId: 1,
			query: { text: 'a story about it' },
			sources: ['projects'],
			sourceOptions: { projects: { pinned: { kind: 'side_project', id: 42 } } }
		});
		expect(mockRelevantProjects).toHaveBeenCalledWith(1, expect.anything(), 3, {
			kind: 'side_project',
			id: 42
		});
		expect(ctx.usedSources).toEqual(['projects']);
	});

	it('retrieves for a pinned project even with no query — the subject is not a guess', async () => {
		mockRelevantProjects.mockResolvedValue(blk('## Relevant projects\n1. Foo — THE SUBJECT'));
		await assembleGenerationContext({
			profileId: 1,
			query: { text: '   ' },
			sources: ['projects'],
			sourceOptions: { projects: { pinned: { kind: 'work_experience_project', id: 7 } } }
		});
		// The empty query would normally cost-gate the whole source out.
		expect(mockRelevantProjects).toHaveBeenCalledWith(1, expect.anything(), 3, {
			kind: 'work_experience_project',
			id: 7
		});
	});

	it('assembles multiple sources, each into its own variable', async () => {
		mockRelevantProjects.mockResolvedValue(blk('## Relevant projects\n1. Foo'));
		mockRelevantStories.mockResolvedValue(blk('## Relevant interview stories\n1. Bar'));
		const ctx = await assembleGenerationContext({
			profileId: 1,
			query: { text: 'leadership under deadline' },
			sources: ['projects', 'stories']
		});
		expect(ctx.variables.relevantProjects).toContain('Relevant projects');
		expect(ctx.variables.relevantStories).toContain('interview stories');
		expect(ctx.usedSources.sort()).toEqual(['projects', 'stories']);
		// The stories source is keyed on the plain relevance query (no JobLike).
		expect(mockRelevantStories).toHaveBeenCalledWith(1, { text: 'leadership under deadline' }, 3);
	});

	it('skips retrieval for every source on an empty query (cost gate)', async () => {
		const ctx = await assembleGenerationContext({
			profileId: 1,
			query: { text: '  ' },
			sources: ['projects', 'stories']
		});
		expect(mockRelevantProjects).not.toHaveBeenCalled();
		expect(mockRelevantStories).not.toHaveBeenCalled();
		expect(ctx.variables.relevantStories).toBe('');
		expect(ctx.usedSources).toEqual([]);
	});

	it('says so when a source rendered but lost the budget race', async () => {
		// The failure this replaces: the documents source produced eleven attached
		// emails, lost the budget race to the job description, and arrived as ""
		// — which the model read as "no documents exist" and reported to the user
		// as having no access to them at all.
		mockRelevantProjects.mockResolvedValue(blk('P'.repeat(4000)));
		mockRelevantStories.mockResolvedValue(blk('S'.repeat(4000)));

		const ctx = await assembleGenerationContext({
			profileId: 1,
			query: { text: 'anything' },
			sources: ['projects', 'stories'],
			budgetChars: 5000
		});

		// Stories rank below projects, so stories is the one that gives way.
		expect(ctx.droppedSources).toEqual(['projects']);
		expect(ctx.variables.relevantProjects).toContain('could not be included');
		// It must not read as an absence — that is the whole point.
		expect(ctx.variables.relevantStories).not.toBe('');
		expect(ctx.variables.relevantProjects).toBe('P'.repeat(4000));
		expect(ctx.usedSources).toEqual(['projects']);
	});

	it('distinguishes a requested-and-empty source from a dropped one', async () => {
		// Three states, not two. "Empty" must not claim the material exists (that
		// is the dropped case) and must not read as "out of scope" either — an
		// empty section is what made the assistant answer "I can't access your
		// uploaded documents" on a page where it could read them and there simply
		// were none, sending the user off to look for a bug that wasn't there.
		mockRelevantProjects.mockResolvedValue(blk(''));
		mockRelevantStories.mockResolvedValue(blk('## stories\n1. Bar'));

		const ctx = await assembleGenerationContext({
			profileId: 1,
			query: { text: 'anything' },
			sources: ['projects', 'stories']
		});

		expect(ctx.droppedSources).toEqual([]);
		expect(ctx.usedSources).toEqual(['stories']);
		expect(ctx.variables.relevantProjects).toContain('nothing here');
		expect(ctx.variables.relevantProjects).toMatch(/never say you lack access/i);
		// Not the dropped wording — that would assert material that isn't there.
		expect(ctx.variables.relevantProjects).not.toContain('could not be included');
	});

	it("says nothing at all about a source that wasn't requested", async () => {
		// Out of scope is the fourth state and stays silent: the prompt's own
		// wording tells the model that absent sections don't apply to this page.
		mockRelevantStories.mockResolvedValue(blk('## stories\n1. Bar'));

		const ctx = await assembleGenerationContext({
			profileId: 1,
			query: { text: 'anything' },
			sources: ['stories']
		});

		expect(ctx.variables.applicationActivity).toBeUndefined();
		expect(ctx.variables.relevantProjects).toBeUndefined();
	});

	it('threads excludeApplicationId to the application_texts source', async () => {
		mockRelevantAppTexts.mockResolvedValue(blk('## past writing\n1. Cover letter'));
		const ctx = await assembleGenerationContext({
			profileId: 1,
			query: { text: 'senior backend role' },
			sources: ['application_texts'],
			excludeApplicationId: 42
		});
		expect(ctx.variables.relevantApplicationTexts).toContain('past writing');
		// The current application (42) is excluded so a letter can't retrieve itself.
		expect(mockRelevantAppTexts).toHaveBeenCalledWith(1, { text: 'senior backend role' }, 3, 42);
	});
});

describe('scoped sources', () => {
	const applicationRequest = {
		profileId: 1,
		entity: { type: 'application' as const, id: 42 },
		sources: ['job', 'application_activity'] as const
	};

	it("loads the job and the application's history from the entity", async () => {
		mockJobDetails.mockResolvedValue('**Position:** Staff Engineer');
		// One source now, so one block: typed records and the text extracted from
		// attached documents arrive interleaved rather than as two variables.
		mockActivity.mockResolvedValue('## What has already happened\n\n### Message: offer.pdf');

		const ctx = await assembleGenerationContext({
			...applicationRequest,
			sources: [...applicationRequest.sources]
		});

		expect(ctx.variables.jobDetails).toContain('Staff Engineer');
		expect(ctx.variables.applicationActivity).toContain('already happened');
		expect(ctx.variables.applicationActivity).toContain('offer.pdf');
		expect(mockJobDetails).toHaveBeenCalledWith({ applicationId: 42 });
		expect(mockActivity).toHaveBeenCalledWith(42, 'compact');
	});

	it('needs no query — scoped sources render the entity, not a ranking', async () => {
		mockActivity.mockResolvedValue('## records');
		const ctx = await assembleGenerationContext({
			profileId: 1,
			entity: { type: 'application', id: 42 },
			sources: ['application_activity']
		});
		expect(ctx.usedSources).toEqual(['application_activity']);
	});

	it('renders nothing for application sources when the entity is a job', async () => {
		// A job page has no application, so there is nothing recorded or attached.
		const ctx = await assembleGenerationContext({
			profileId: 1,
			entity: { type: 'job', id: 5 },
			sources: ['job', 'application_activity']
		});
		expect(mockActivity).not.toHaveBeenCalled();
		expect(mockActivity).not.toHaveBeenCalled();
		expect(mockJobDetails).toHaveBeenCalledWith({ jobId: 5 });
		expect(ctx.variables.applicationActivity).toBe('');
	});

	it('passes the per-source detail knob through', async () => {
		await assembleGenerationContext({
			profileId: 1,
			entity: { type: 'application', id: 42 },
			sources: ['application_activity'],
			sourceOptions: { application_activity: { detail: 'full' } }
		});
		expect(mockActivity).toHaveBeenCalledWith(42, 'full');
	});

	it('defaults exclusion to the application in scope', async () => {
		mockRelevantAppTexts.mockResolvedValue(blk('past writing'));
		await assembleGenerationContext({
			profileId: 1,
			query: { text: 'why do you want to work here' },
			entity: { type: 'application', id: 42 },
			sources: ['application_texts']
		});
		// You are never your own prior art — no explicit excludeApplicationId needed.
		expect(mockRelevantAppTexts).toHaveBeenCalledWith(1, expect.anything(), 3, 42);
	});

	it('renders the profile blob as the `data` variable, under the budget', async () => {
		mockLoadProfile.mockResolvedValue({ data: { name: 'Alex' }, schema: {} });
		const ctx = await assembleGenerationContext({
			profileId: 1,
			sources: ['profile'],
			profileFields: ['name']
		});
		expect(ctx.variables.data).toBe('{"name":"Alex"}');
		expect(mockLoadProfile).toHaveBeenCalledWith(1, ['name']);
	});

	it('reuses a preloaded profile instead of querying again', async () => {
		const ctx = await assembleGenerationContext({
			profileId: 1,
			sources: ['profile'],
			preloadedProfile: { data: { name: 'Sam' }, schema: {} }
		});
		expect(mockLoadProfile).not.toHaveBeenCalled();
		expect(ctx.variables.data).toBe('{"name":"Sam"}');
	});

	it('does not charge the profile blob against the evidence budget', async () => {
		// Measured on dev, the blob runs 48–106k chars — several times any sane
		// evidence budget. If it competed, it would always win and every other
		// source would be dropped on exactly the profiles worth retrieving from.
		mockLoadProfile.mockResolvedValue({
			data: { bio: 'x'.repeat(5000) },
			schema: {}
		});
		mockRelevantProjects.mockResolvedValue(blk('y'.repeat(500)));

		const ctx = await assembleGenerationContext({
			profileId: 1,
			query: { text: 'anything' },
			sources: ['profile', 'projects'],
			budgetChars: 600
		});

		expect(ctx.usedSources.sort()).toEqual(['profile', 'projects']);
		expect(ctx.variables.relevantProjects).toHaveLength(500);
		expect(ctx.profileChars).toBeGreaterThan(5000);
	});

	it('still rations the evidence sources against each other', async () => {
		mockLoadProfile.mockResolvedValue({
			data: { bio: 'x'.repeat(5000) },
			schema: {}
		});
		mockJobDetails.mockResolvedValue('j'.repeat(500));
		mockRelevantProjects.mockResolvedValue(blk('y'.repeat(500)));

		const ctx = await assembleGenerationContext({
			profileId: 1,
			query: { text: 'anything' },
			entity: { type: 'application', id: 42 },
			sources: ['profile', 'job', 'projects'],
			budgetChars: 600
		});

		// Only one 500-char evidence block fits; the job outranks retrieval.
		expect(ctx.usedSources.sort()).toEqual(['job', 'profile']);
		// The loser is announced rather than blanked: an empty section reads to the
		// model as "this doesn't exist", which is how the assistant came to tell a
		// user it had no access to documents it had just been handed.
		expect(ctx.droppedSources).toEqual(['stories']);
		expect(ctx.variables.relevantStories).toContain('could not be included');
	});
});

describe('the retrieval record', () => {
	const projectItem: RetrievalItem = {
		source: 'projects',
		kind: 'side_project',
		id: 7,
		title: 'Acme migration',
		score: 0.61,
		via: 'semantic'
	};
	const storyItem: RetrievalItem = {
		source: 'stories',
		kind: 'story',
		id: 3,
		title: 'The outage',
		score: 0.55,
		via: 'semantic'
	};

	it('records what the model was shown, by source, ranker and score', async () => {
		mockRelevantProjects.mockResolvedValue(blk('## projects\n1. Acme', [projectItem]));

		const ctx = await assembleGenerationContext({
			profileId: 1,
			query: { text: 'tell us about a migration', skills: ['postgres'] },
			sources: ['projects']
		});

		expect(ctx.retrieval.items).toEqual([projectItem]);
		expect(ctx.retrieval.used).toEqual(['projects']);
		expect(ctx.retrieval.rankers).toEqual({ projects: 'semantic' });
		expect(ctx.retrieval.query).toEqual({
			text: 'tell us about a migration',
			skills: ['postgres']
		});
		expect(ctx.retrieval.chars.projects).toBeGreaterThan(0);
	});

	it('omits the picks of a source that lost the budget race', async () => {
		// The source ran, so its ranker is recorded and it is named in `dropped`.
		// Its items are not: they never reached the model, and listing them would
		// tell the applicant their draft drew on a story it was never shown.
		mockRelevantProjects.mockResolvedValue(blk('P'.repeat(4000), [projectItem]));
		mockRelevantStories.mockResolvedValue(blk('S'.repeat(4000), [storyItem]));

		const ctx = await assembleGenerationContext({
			profileId: 1,
			query: { text: 'anything' },
			sources: ['projects', 'stories'],
			budgetChars: 5000
		});

		expect(ctx.retrieval.items).toEqual([projectItem]);
		expect(ctx.retrieval.dropped).toEqual(['stories']);
		expect(ctx.retrieval.rankers).toEqual({ projects: 'semantic', stories: 'semantic' });
	});

	it('separates a ranker that found nothing from one that never ran', async () => {
		// An empty list from a live embedding search and one from a provider that
		// never answered are the same absence and different problems, so the
		// ranker is recorded either way — and only the source that actually
		// looked is listed as empty.
		mockRelevantProjects.mockResolvedValue(blk('', [], 'overlap'));

		const ctx = await assembleGenerationContext({
			profileId: 1,
			query: { text: 'anything' },
			sources: ['projects', 'application_pipeline']
		});

		expect(ctx.retrieval.items).toEqual([]);
		expect(ctx.retrieval.rankers).toEqual({ projects: 'overlap' });
		expect(ctx.retrieval.empty).toContain('projects');
	});

	it('records nothing retrieved when no ranked source was requested', async () => {
		// A review or a revise draws only on scoped sources. The record must not
		// then read as "we searched the profile and it is empty".
		mockJobDetails.mockResolvedValue('the job');

		const ctx = await assembleGenerationContext({
			profileId: 1,
			entity: { type: 'application', id: 42 },
			sources: ['job']
		});

		expect(ctx.retrieval.items).toEqual([]);
		expect(ctx.retrieval.rankers).toEqual({});
		expect(ctx.retrieval.query).toBeUndefined();
	});

	it('clips the stored query instead of keeping a whole job description', async () => {
		mockRelevantProjects.mockResolvedValue(blk('blk', [projectItem]));

		const ctx = await assembleGenerationContext({
			profileId: 1,
			query: { text: 'q'.repeat(2000) },
			sources: ['projects']
		});

		expect(ctx.retrieval.query?.text).toHaveLength(QUERY_CLIP_CHARS);
	});

	it('reports the profile blob separately from the evidence budget', async () => {
		mockLoadProfile.mockResolvedValue({ data: { bio: 'x'.repeat(5000) }, schema: {} });
		mockRelevantProjects.mockResolvedValue(blk('y'.repeat(500), [projectItem]));

		const ctx = await assembleGenerationContext({
			profileId: 1,
			query: { text: 'anything' },
			sources: ['profile', 'projects'],
			budgetChars: 600
		});

		expect(ctx.retrieval.budgetChars).toBe(600);
		expect(ctx.retrieval.profileChars).toBeGreaterThan(5000);
		// The blob is exempt from the evidence budget, so it is not charged here.
		expect(ctx.retrieval.chars.profile).toBeUndefined();
	});
});
