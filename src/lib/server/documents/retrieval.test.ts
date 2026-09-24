import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const expandForRetrieval = vi.fn();
vi.mock('$lib/server/job/skill-ontology', () => ({
	expandForRetrieval: (...args: unknown[]) => expandForRetrieval(...args)
}));

// Only rankedProfileProjects reaches these: the profile's projects and their
// cosine scores, faked so the merge switch can be driven end to end.
const sideProjects = vi.fn();
const semanticScoreProjects = vi.fn();
vi.mock('$lib/server/db', () => ({
	dbDirect: {
		query: {
			side_projects: { findMany: () => sideProjects() },
			work_experiences: { findMany: async () => [] }
		}
	}
}));
vi.mock('./project-embeddings', async (importOriginal) => ({
	...(await importOriginal<typeof import('./project-embeddings')>()),
	semanticScoreProjects: (...args: unknown[]) => semanticScoreProjects(...args)
}));

import { config } from '$lib/server/config';
import {
	buildDocEvidence,
	type DocRow,
	formatProjectCitations,
	formatSupportingEvidence,
	mergeProjectRankings,
	pickGraphSlot,
	type RankableProject,
	rankBySemanticScores,
	rankedProfileProjects,
	rankProjects,
	relevantProjectsBlock,
	scoreProjectAgainstJob,
	widenProjectKeywords,
	withGraphPick
} from './retrieval';

const proj = (id: number, keywords: string[], text = ''): RankableProject => ({
	kind: 'side_project',
	id,
	title: `p${id}`,
	context: '',
	keywords,
	text,
	citation: ''
});

describe('scoreProjectAgainstJob', () => {
	it('weights explicit required-skill matches highest', () => {
		const job = {
			title: 'Backend Engineer',
			skills_required: ['PostgreSQL', 'Redis']
		};
		expect(scoreProjectAgainstJob(proj(1, ['PostgreSQL', 'Redis']), job)).toBe(6);
	});

	it('matches loosely (postgres ~ PostgreSQL) and counts text mentions', () => {
		const job = {
			title: 'We use Kubernetes heavily',
			skills_required: ['postgres']
		};
		// PostgreSQL ↔ postgres skill match (3); Kubernetes in title (1)
		expect(scoreProjectAgainstJob(proj(1, ['PostgreSQL', 'Kubernetes']), job)).toBe(4);
	});

	it("credits a required skill mentioned only in the project's prose", () => {
		const job = { skills_required: ['Kubernetes'] };
		// No keywords, but the description mentions the skill → +1
		expect(scoreProjectAgainstJob(proj(1, [], 'we deployed it on Kubernetes'), job)).toBe(1);
	});

	it('scores an unrelated project zero', () => {
		const job = { skills_required: ['COBOL', 'Fortran'] };
		expect(scoreProjectAgainstJob(proj(1, ['React', 'Tailwind']), job)).toBe(0);
	});
});

describe('rankProjects', () => {
	const job = {
		title: 'Full-stack role',
		skills_required: ['TypeScript', 'PostgreSQL', 'Docker']
	};

	it('orders by score and drops irrelevant projects', () => {
		const ranked = rankProjects(
			[
				proj(1, ['COBOL']),
				proj(2, ['TypeScript']),
				proj(3, ['TypeScript', 'PostgreSQL', 'Docker'])
			],
			job
		);
		expect(ranked.map((p) => p.id)).toEqual([3, 2]);
	});

	it('caps at k', () => {
		const ranked = rankProjects(
			[proj(1, ['TypeScript']), proj(2, ['PostgreSQL']), proj(3, ['Docker'])],
			job,
			2
		);
		expect(ranked).toHaveLength(2);
	});

	it('returns empty when nothing is relevant', () => {
		expect(rankProjects([proj(1, ['Assembly'])], job)).toEqual([]);
	});
});

describe('formatProjectCitations', () => {
	const ranked = (over: Partial<RankableProject> = {}): RankableProject => ({
		kind: 'work_experience_project',
		id: 1,
		title: 'Payments Migration',
		context: 'at Acme Corp',
		keywords: ['Kafka'],
		text: '',
		citation: 'Migrated billing to microservices.',
		...over
	});

	it('returns empty string when there are no projects', () => {
		expect(formatProjectCitations([])).toBe('');
	});

	it('emits a self-contained block with title, context, and citation', () => {
		const out = formatProjectCitations([ranked()]);
		expect(out).toContain('Relevant projects from the applicant');
		expect(out).toContain('1. Payments Migration (at Acme Corp)');
		expect(out).toContain('Migrated billing to microservices.');
	});

	it('omits the parenthetical when there is no context', () => {
		const out = formatProjectCitations([ranked({ context: '', title: 'Solo App' })]);
		expect(out).toContain('1. Solo App\n');
		expect(out).not.toContain('Solo App (');
	});

	it('names the pinned project as the subject and says it was not inferred', () => {
		const out = formatProjectCitations([
			ranked({ pinned: true }),
			ranked({ id: 2, title: 'Other', context: '' })
		]);
		expect(out).toContain('1. Payments Migration (at Acme Corp) — THE SUBJECT');
		expect(out).toContain('2. Other\n');
		expect(out).toContain('it was not inferred');
	});

	it('says nothing about a subject when nothing is pinned', () => {
		const out = formatProjectCitations([ranked()]);
		expect(out).not.toContain('THE SUBJECT');
		expect(out).not.toContain('was not inferred');
	});
});

describe('formatSupportingEvidence', () => {
	const ranked = (over: Partial<RankableProject> = {}): RankableProject => ({
		kind: 'work_experience_project',
		id: 1,
		title: 'Payments Migration',
		context: 'at Acme Corp',
		keywords: [],
		text: '',
		citation: '',
		docEvidence: '- OrderService repo: distributed payments backend [Kafka]',
		...over
	});

	it('returns empty when no project has attachment evidence', () => {
		expect(formatSupportingEvidence([ranked({ docEvidence: '' })])).toBe('');
		expect(formatSupportingEvidence([])).toBe('');
	});

	it('emits only attachment evidence, neutrally framed (not advocacy)', () => {
		const out = formatSupportingEvidence([ranked()]);
		expect(out).toContain('Supporting evidence from the applicant');
		expect(out).toContain('weigh for BOTH fit and gaps');
		expect(out).toContain('### Payments Migration (at Acme Corp)');
		expect(out).toContain('OrderService repo');
	});

	it('skips projects without evidence but keeps those with it', () => {
		const out = formatSupportingEvidence([
			ranked({ id: 1, title: 'Has Docs' }),
			ranked({ id: 2, title: 'No Docs', docEvidence: '' })
		]);
		expect(out).toContain('### Has Docs');
		expect(out).not.toContain('### No Docs');
	});
});

describe('buildDocEvidence', () => {
	const doc = (over: Partial<DocRow> = {}): DocRow => ({
		id: 1,
		title: 'OrderService repo',
		original_filename: 'orderservice.zip',
		summary: 'Distributed payments backend.',
		keywords: ['Kafka', 'PostgreSQL'],
		...over
	});

	it('emits one bullet per attachment with summary and bracketed keywords', () => {
		expect(buildDocEvidence([doc()])).toBe(
			'- OrderService repo: Distributed payments backend. [Kafka, PostgreSQL]'
		);
	});

	it("falls back title → filename → 'Source' for the label", () => {
		expect(buildDocEvidence([doc({ title: null })])).toContain('- orderservice.zip:');
		expect(buildDocEvidence([doc({ title: null, original_filename: null })])).toContain(
			'- Source:'
		);
	});

	it('skips an attachment with neither summary nor keywords', () => {
		expect(buildDocEvidence([doc({ summary: null, keywords: [] })])).toBe('');
		expect(buildDocEvidence([])).toBe('');
	});

	it('omits the bracket when there are no keywords', () => {
		const out = buildDocEvidence([doc({ keywords: null })]);
		expect(out).toBe('- OrderService repo: Distributed payments backend.');
		expect(out).not.toContain('[');
	});
});

describe('widenProjectKeywords (the Graph half of GraphRAG)', () => {
	/** expandForRetrieval's shape: seed slug -> what it reaches. */
	const graph = (m: Record<string, string[]>) =>
		new Map(
			Object.entries(m).map(([seed, labels]) => [
				seed,
				labels.map((label, i) => ({ slug: label.toLowerCase(), label, depth: i }))
			])
		);

	beforeEach(() => {
		expandForRetrieval.mockReset();
	});

	it('adds what a project skill implies, keeping the original', async () => {
		expandForRetrieval.mockResolvedValue(
			graph({ svelte: ['Svelte', 'Frontend development', 'Web development'] })
		);
		const [p] = await widenProjectKeywords([{ keywords: ['Svelte'] }]);
		expect(p.keywords).toEqual(['Svelte', 'Frontend development', 'Web development']);
	});

	it('widens each project from its OWN skills, not the pooled set', async () => {
		expandForRetrieval.mockResolvedValue(
			graph({ svelte: ['Frontend development'], django: ['Python'] })
		);
		const [fe, be] = await widenProjectKeywords([
			{ keywords: ['Svelte'] },
			{ keywords: ['Django'] }
		]);
		expect(fe.keywords).toEqual(['Svelte', 'Frontend development']);
		expect(be.keywords).toEqual(['Django', 'Python']);
		// The failure this guards: a flat union would give both projects both terms.
		expect(fe.keywords).not.toContain('Python');
	});

	it('resolves a skill through normalizeSkill, not raw text', async () => {
		expandForRetrieval.mockResolvedValue(graph({ nodejs: ['JavaScript'] }));
		const [p] = await widenProjectKeywords([{ keywords: ['Node.js'] }]);
		expect(p.keywords).toEqual(['Node.js', 'JavaScript']);
	});

	it('does not duplicate a term the project already lists', async () => {
		expandForRetrieval.mockResolvedValue(graph({ svelte: ['Svelte', 'Frontend development'] }));
		const [p] = await widenProjectKeywords([{ keywords: ['Svelte', 'Frontend development'] }]);
		expect(p.keywords).toEqual(['Svelte', 'Frontend development']);
	});

	it('leaves projects untouched when the graph knows none of their skills', async () => {
		expandForRetrieval.mockResolvedValue(new Map());
		const projects = [{ keywords: ['Underwater basket weaving'] }];
		expect(await widenProjectKeywords(projects)).toBe(projects);
	});

	it('falls back to the raw project skills when the traversal fails', async () => {
		expandForRetrieval.mockRejectedValue(new Error('no database'));
		const projects = [{ keywords: ['Svelte'] }];
		expect(await widenProjectKeywords(projects)).toBe(projects);
	});

	it('widens through an expander the caller passes, instead of the database', async () => {
		const snapshot = vi.fn().mockResolvedValue(graph({ svelte: ['Frontend development'] }));
		const [p] = await widenProjectKeywords([{ keywords: ['Svelte'] }], snapshot);
		expect(p.keywords).toEqual(['Svelte', 'Frontend development']);
		expect(snapshot).toHaveBeenCalledWith(['Svelte']);
		expect(expandForRetrieval).not.toHaveBeenCalled();
	});

	it('does not touch the graph when no project lists a skill', async () => {
		const projects = [{ keywords: [] }];
		expect(await widenProjectKeywords(projects)).toBe(projects);
		expect(expandForRetrieval).not.toHaveBeenCalled();
	});

	it('surfaces a project the raw skills miss — the whole point', async () => {
		// The job asks for the general term; the project names the specific one.
		const job = { skills_required: ['Frontend development'] };
		const project = { keywords: ['Svelte', 'Vite'], text: '' };
		expect(scoreProjectAgainstJob(project, job)).toBe(0);

		expandForRetrieval.mockResolvedValue(graph({ svelte: ['Frontend development'] }));
		const [widened] = await widenProjectKeywords([project]);
		expect(scoreProjectAgainstJob(widened, job)).toBe(3);
	});

	it('scores one hit per concept, not one per sibling technology', async () => {
		// Widening the JOB downward would score this project 4x on one requirement.
		expandForRetrieval.mockResolvedValue(
			graph({ svelte: ['Frontend development'], react: ['Frontend development'] })
		);
		const [widened] = await widenProjectKeywords([{ keywords: ['Svelte', 'React'] }]);
		expect(scoreProjectAgainstJob(widened, { skills_required: ['Frontend development'] })).toBe(3);
	});
});

describe('withGraphPick (the union, not a fallback)', () => {
	const graph = (m: Record<string, string[]>) =>
		new Map(
			Object.entries(m).map(([seed, labels]) => [
				seed,
				labels.map((label, i) => ({ slug: label.toLowerCase(), label, depth: i }))
			])
		);
	const job = { title: 'Frontend Engineer', skills_required: ['Frontend development'] };
	const scored = (p: RankableProject, score: number) => ({ ...p, score });

	beforeEach(() => {
		expandForRetrieval.mockReset();
		expandForRetrieval.mockResolvedValue(graph({ svelte: ['Frontend development'] }));
	});

	it('fills a spare slot without displacing anything', async () => {
		const semantic = [scored(proj(1, ['React']), 0.9)];
		const out = await withGraphPick(semantic, [proj(1, ['React']), proj(2, ['Svelte'])], job, 3);
		expect(out.map((p) => p.id)).toEqual([1, 2]);
		expect(out[1].viaGraph).toBe(true);
	});

	it('takes the LAST slot when semantic filled them all, never the first', async () => {
		const semantic = [
			scored(proj(1, ['React']), 0.9),
			scored(proj(3, ['Vue']), 0.6),
			scored(proj(4, ['Angular']), 0.55)
		];
		const out = await withGraphPick(
			semantic,
			[proj(1, ['React']), proj(3, ['Vue']), proj(4, ['Angular']), proj(2, ['Svelte'])],
			job,
			3
		);
		expect(out).toHaveLength(3);
		// The two the semantic ranker was most confident about survive; the third
		// is the one traded away.
		expect(out.map((p) => p.id)).toEqual([1, 3, 2]);
		expect(out[0].viaGraph).toBeUndefined();
	});

	it('leaves semantic alone when the graph finds nothing it had missed', async () => {
		const semantic = [scored(proj(2, ['Svelte']), 0.8)];
		const out = await withGraphPick(semantic, [proj(2, ['Svelte'])], job, 3);
		expect(out).toBe(semantic);
	});

	it('leaves semantic alone when widening scores nobody against this job', async () => {
		expandForRetrieval.mockResolvedValue(graph({ cobol: ['Mainframes'] }));
		const semantic = [scored(proj(1, ['React']), 0.9)];
		const out = await withGraphPick(semantic, [proj(1, ['React']), proj(9, ['COBOL'])], job, 3);
		expect(out).toBe(semantic);
	});

	it('survives an unreachable graph, since widening never throws', async () => {
		expandForRetrieval.mockRejectedValue(new Error('no database'));
		const semantic = [scored(proj(1, ['React']), 0.9)];
		// proj 2 still scores on its own un-widened keyword, so the union degrades
		// to plain keyword overlap rather than to nothing.
		const out = await withGraphPick(
			semantic,
			[proj(1, ['React']), proj(2, ['Frontend development'])],
			job,
			3
		);
		expect(out.map((p) => p.id)).toEqual([1, 2]);
	});

	it('gives the newcomer the floor score, so appending cannot reorder the list', async () => {
		const semantic = [scored(proj(1, ['React']), 0.9), scored(proj(3, ['Vue']), 0.61)];
		const out = await withGraphPick(
			semantic,
			[proj(1, ['React']), proj(3, ['Vue']), proj(2, ['Svelte'])],
			job,
			3
		);
		expect(out[2].score).toBe(0.61);
	});
});

describe('pickGraphSlot (the pure half of withGraphPick)', () => {
	const scored = (id: number, score: number) => ({ ...proj(id, []), score });

	it('looks only at the top K of the keyword list, as withGraphPick always did', () => {
		// Project 4 is new to semantic but fourth on the keyword list: with K = 3
		// it is out of reach, however the full list is passed.
		const semantic = [scored(1, 0.9), scored(2, 0.8), scored(3, 0.7)];
		const keyword = [scored(1, 9), scored(2, 8), scored(3, 7), scored(4, 6)];
		expect(pickGraphSlot(semantic, keyword, 3)).toBe(semantic);
	});

	it('takes the first keyword pick semantic lacks, into the last slot', () => {
		const semantic = [scored(1, 0.9), scored(2, 0.8), scored(3, 0.7)];
		const out = pickGraphSlot(semantic, [scored(2, 9), scored(5, 3)], 3);
		expect(out.map((p) => [p.id, p.score, p.viaGraph])).toEqual([
			[1, 0.9, undefined],
			[2, 0.8, undefined],
			// The floor of the list it joined: the score of the pick it displaced.
			[5, 0.7, true]
		]);
	});
});

describe('rankBySemanticScores', () => {
	const scores = new Map([
		['side_project:1', 0.62],
		['side_project:2', 0.5],
		['side_project:3', 0.49],
		['side_project:4', 0.8]
	]);
	const all = [1, 2, 3, 4, 5].map((id) => proj(id, []));

	it('returns every project at or above the floor, best first, when no K is given', () => {
		expect(rankBySemanticScores(all, scores, undefined, 0.5).map((p) => p.id)).toEqual([4, 1, 2]);
	});

	it('still takes a top K and a floor when given', () => {
		expect(rankBySemanticScores(all, scores, 1, 0.5).map((p) => p.id)).toEqual([4]);
		expect(rankBySemanticScores(all, scores, undefined, 0.7).map((p) => p.id)).toEqual([4]);
	});
});

describe('mergeProjectRankings', () => {
	const sem = (id: number, score: number) => ({ ...proj(id, []), score });
	const kw = sem;

	describe('fallbacks, the same in both modes', () => {
		for (const mode of ['graph_slot', 'fused'] as const) {
			it(`${mode}: no semantic list means the keyword list alone decides`, () => {
				const out = mergeProjectRankings([], [kw(1, 6), kw(2, 3), kw(3, 3), kw(4, 1)], 3, mode);
				expect(out.ranker).toBe('overlap');
				expect(out.ranked.map((p) => p.id)).toEqual([1, 2, 3]);
				expect(out.ranked.every((p) => p.via === undefined)).toBe(true);
			});

			it(`${mode}: both empty means nothing`, () => {
				expect(mergeProjectRankings([], [], 3, mode)).toEqual({ ranked: [], ranker: 'overlap' });
			});

			it(`${mode}: an empty keyword list leaves the semantic list to decide`, () => {
				const out = mergeProjectRankings(
					[sem(1, 0.7), sem(2, 0.6), sem(3, 0.55), sem(4, 0.51)],
					[],
					3,
					mode
				);
				expect(out.ranker).toBe('semantic');
				expect(out.ranked.map((p) => [p.id, p.score])).toEqual([
					[1, 0.7],
					[2, 0.6],
					[3, 0.55]
				]);
			});
		}
	});

	describe('graph_slot (today, and the default)', () => {
		it('is withGraphPick on the top K of each list', () => {
			const out = mergeProjectRankings(
				[sem(1, 0.9), sem(2, 0.8), sem(3, 0.7), sem(4, 0.6)],
				[kw(2, 9), kw(7, 4)],
				3,
				'graph_slot'
			);
			expect(out.ranker).toBe('semantic');
			expect(out.ranked.map((p) => [p.id, p.viaGraph])).toEqual([
				[1, undefined],
				[2, undefined],
				[7, true]
			]);
		});
	});

	describe('fused', () => {
		it('lets fourth on both lists beat first on only one', () => {
			// The whole case for fusing FULL lists: with top-3 lists project 4 would
			// be on neither and could never be picked.
			const out = mergeProjectRankings(
				[sem(1, 0.9), sem(2, 0.8), sem(3, 0.7), sem(4, 0.6)],
				[kw(5, 12), kw(6, 9), kw(7, 6), kw(4, 3)],
				3,
				'fused'
			);
			expect(out.ranker).toBe('fused');
			expect(out.ranked[0]).toMatchObject({ id: 4, via: 'both', semanticRank: 4, keywordRank: 4 });
			expect(out.ranked[0].score).toBeCloseTo(2 / 64, 12);
		});

		it('names the list that found each pick and records only the ranks it has', () => {
			const out = mergeProjectRankings(
				[sem(1, 0.9), sem(2, 0.8)],
				[kw(2, 5), kw(3, 4)],
				3,
				'fused'
			);
			expect(out.ranked.map((p) => [p.id, p.via, p.semanticRank, p.keywordRank])).toEqual([
				[2, 'both', 2, 1],
				[1, 'semantic', 1, undefined],
				[3, 'keyword', undefined, 2]
			]);
			expect(out.ranked[1]).not.toHaveProperty('keywordRank');
			expect(out.ranked[2]).not.toHaveProperty('semanticRank');
			expect(out.ranked.every((p) => !p.viaGraph)).toBe(true);
		});

		it('takes K and no more', () => {
			const out = mergeProjectRankings(
				[sem(1, 0.9), sem(2, 0.8)],
				[kw(3, 5), kw(4, 4)],
				2,
				'fused'
			);
			expect(out.ranked).toHaveLength(2);
		});

		it('gives tied keyword scores one rank, and breaks equal fused scores by semantic rank', () => {
			// 3 and 4 tie on keywords, so both are keyword rank 1; 4 is higher on
			// semantic. Without shared ranks, 3 would win by being listed first.
			const out = mergeProjectRankings(
				[sem(4, 0.8), sem(3, 0.7)],
				[kw(3, 6), kw(4, 6)],
				2,
				'fused'
			);
			expect(out.ranked.map((p) => [p.id, p.keywordRank])).toEqual([
				[4, 1],
				[3, 1]
			]);
		});

		it('breaks a tie between a semantic-only and a keyword-only pick toward semantic', () => {
			const out = mergeProjectRankings([sem(1, 0.9)], [kw(2, 5)], 3, 'fused');
			expect(out.ranked.map((p) => p.id)).toEqual([1, 2]);
		});

		it('takes k and weights from the caller, for the golden set to compare', () => {
			const semantic = [sem(1, 0.9), sem(2, 0.8)];
			const keyword = [kw(2, 5), kw(3, 4)];
			// Semantic weighted double: its first pick now beats the both-lists pick.
			const out = mergeProjectRankings(semantic, keyword, 3, 'fused', {
				k: 60,
				weights: { semantic: 2 }
			});
			expect(out.ranked.map((p) => p.id)).toEqual([2, 1, 3]);
			const heavy = mergeProjectRankings(semantic, keyword, 3, 'fused', {
				k: 1,
				weights: { semantic: 4 }
			});
			expect(heavy.ranked.map((p) => p.id)).toEqual([1, 2, 3]);
		});
	});
});

describe('rankedProfileProjects: the SJS_PROJECT_RETRIEVAL_MERGE switch', () => {
	const job = { title: 'Frontend Engineer', skills_required: ['Svelte'] };
	const side = (id: number, name: string, techs: string[]) => ({
		id,
		name,
		summary: '',
		side_project_technologies: techs.map((name) => ({ name })),
		side_project_achievements: [],
		profile_document_projects: []
	});
	const mode = config.projectRetrievalMerge;

	beforeEach(() => {
		expandForRetrieval.mockReset();
		expandForRetrieval.mockResolvedValue(new Map());
		// Four projects; semantic likes 1-3, only 4 lists the required skill.
		sideProjects.mockResolvedValue([
			side(1, 'One', ['React']),
			side(2, 'Two', ['Vue']),
			side(3, 'Three', ['Angular']),
			side(4, 'Four', ['Svelte'])
		]);
		semanticScoreProjects.mockResolvedValue(
			new Map([
				['side_project:1', 0.9],
				['side_project:2', 0.8],
				['side_project:3', 0.7],
				['side_project:4', 0.4]
			])
		);
	});
	afterEach(() => {
		config.projectRetrievalMerge = mode;
	});

	it('defaults to the graph slot', () => {
		expect(mode).toBe('graph_slot');
	});

	it('graph_slot: the keyword pick displaces the last semantic one, marked graph', async () => {
		config.projectRetrievalMerge = 'graph_slot';
		const { ranked, ranker } = await rankedProfileProjects(1, job, 3);
		expect(ranker).toBe('semantic');
		expect(ranked.map((p) => [p.id, p.via])).toEqual([
			[1, 'semantic'],
			[2, 'semantic'],
			[4, 'graph']
		]);
		expect(ranked.some((p) => p.semanticRank !== undefined)).toBe(false);
	});

	it('fused: the same lists merged by rank, each pick saying which list found it', async () => {
		config.projectRetrievalMerge = 'fused';
		const { ranked, ranker } = await rankedProfileProjects(1, job, 3);
		expect(ranker).toBe('fused');
		// 1 (semantic #1) and 4 (keyword #1, under the floor) tie at 1/61; semantic
		// wins the tie. 2 (semantic #2) takes the third slot, 3 is out.
		expect(ranked.map((p) => [p.id, p.via])).toEqual([
			[1, 'semantic'],
			[4, 'keyword'],
			[2, 'semantic']
		]);
	});

	it('fused: a pinned project still takes the first slot, unranked', async () => {
		config.projectRetrievalMerge = 'fused';
		const { ranked } = await rankedProfileProjects(1, job, 3, { kind: 'side_project', id: 3 });
		expect(ranked.map((p) => [p.id, p.via])).toEqual([
			[3, 'pinned'],
			[1, 'semantic'],
			[4, 'keyword']
		]);
	});

	it('fused: embeddings unavailable falls back to the keyword list, as today', async () => {
		config.projectRetrievalMerge = 'fused';
		semanticScoreProjects.mockResolvedValue(null);
		const { ranked, ranker } = await rankedProfileProjects(1, job, 3);
		expect(ranker).toBe('overlap');
		expect(ranked.map((p) => [p.id, p.via])).toEqual([[4, 'overlap']]);
	});

	it('fused: the record carries the ranks and the fused score', async () => {
		config.projectRetrievalMerge = 'fused';
		const block = await relevantProjectsBlock(1, job, 3);
		expect(block.ranker).toBe('fused');
		expect(block.items[0]).toMatchObject({ id: 1, via: 'semantic', semanticRank: 1 });
		expect(block.items[0]).not.toHaveProperty('keywordRank');
		expect(block.items[1]).toMatchObject({ id: 4, via: 'keyword', keywordRank: 1 });
		expect(block.items[1]).not.toHaveProperty('semanticRank');
		expect(block.items[0].score).toBeCloseTo(1 / 61, 12);
	});

	it('graph_slot: the record has no ranks, exactly as before', async () => {
		config.projectRetrievalMerge = 'graph_slot';
		const block = await relevantProjectsBlock(1, job, 3);
		for (const item of block.items) {
			expect(item).not.toHaveProperty('semanticRank');
			expect(item).not.toHaveProperty('keywordRank');
		}
		expect(block.items.map((i) => i.score)).toEqual([0.9, 0.8, 0.7]);
	});
});
