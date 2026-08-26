import { beforeEach, describe, expect, it, vi } from 'vitest';

const expandForRetrieval = vi.fn();
vi.mock('$lib/server/job/skill-ontology', () => ({
	expandForRetrieval: (...args: unknown[]) => expandForRetrieval(...args)
}));

import {
	buildDocEvidence,
	type DocRow,
	formatProjectCitations,
	formatSupportingEvidence,
	type RankableProject,
	rankProjects,
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
