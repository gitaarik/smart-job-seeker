import { beforeEach, describe, expect, it, vi } from 'vitest';

// The module reaches for the database, the model and the embedding provider at
// import time; none of that is what these tests are about.
vi.mock('$lib/server/db', () => ({ dbDirect: { query: {} } }));
vi.mock('$lib/server/ai-chat/utils', () => ({ createAndGenerateAiChat: vi.fn() }));
vi.mock('$lib/server/documents/content-embeddings', () => ({
	semanticScoreUnits: vi.fn(),
	poolKey: (t: string, id: number) => `${t}:${id}`
}));
vi.mock('$lib/server/documents/content-retrieval', () => ({
	scoreUnitAgainstQuery: vi.fn(() => 0)
}));
vi.mock('$lib/server/job/skill-ontology', () => ({
	expandUpwardBySeed: vi.fn(async () => new Map()),
	resolveConcepts: vi.fn(async () => new Map())
}));

import {
	applyModelOpinions,
	applyVerdictReasons,
	buildCandidates,
	markCoverage,
	refFor,
	shortlistFor
} from '../tailor-version';
import { expandUpwardBySeed } from '$lib/server/job/skill-ontology';
import { OVERRIDE_ENTITIES } from '$lib/version-overrides';
import type { Candidate, Decision } from '$lib/tailoring';

function bullet(id: number, score: number, over: Partial<Candidate> = {}): Candidate {
	return {
		entityType: OVERRIDE_ENTITIES.achievement,
		entityId: id,
		parentId: 1,
		label: `bullet ${id}`,
		chars: 100,
		visible: true,
		pinned: false,
		score,
		...over
	};
}

const FLOOR = 0.5;

describe('refFor', () => {
	it('names each entity in terms the model can copy back', () => {
		expect(refFor({ entityType: OVERRIDE_ENTITIES.achievement, entityId: 7 })).toBe('bullet:7');
		expect(refFor({ entityType: OVERRIDE_ENTITIES.sideProject, entityId: 7 })).toBe('project:7');
		expect(refFor({ entityType: OVERRIDE_ENTITIES.skill, entityId: 7 })).toBe('skill:7');
	});
});

describe('applyModelOpinions', () => {
	it('sinks a dropped candidate below any floor', () => {
		const candidates = [bullet(1, 0.9)];
		const { candidates: adjusted } = applyModelOpinions(
			candidates,
			[{ ref: 'bullet:1', action: 'drop', reason: 'Not relevant here.' }],
			FLOOR
		);
		expect(adjusted[0].score).toBeLessThan(FLOOR);
	});

	it('lifts a kept candidate to the floor without inventing relevance', () => {
		const candidates = [bullet(1, 0.1)];
		const { candidates: adjusted } = applyModelOpinions(
			candidates,
			[{ ref: 'bullet:1', action: 'keep', reason: 'The only Kubernetes evidence.' }],
			FLOOR
		);
		expect(adjusted[0].score).toBe(FLOOR);
	});

	it('carries the reason through, so the applicant reads the model, not the ranker', () => {
		const { verdicts } = applyModelOpinions(
			[bullet(1, 0.9)],
			[{ ref: 'bullet:1', action: 'drop', reason: 'Frontend work, not data engineering.' }],
			FLOOR
		);
		// The action rides along with the reason: a sentence written to defend an
		// item must not end up next to an exclusion that overruled it.
		expect(verdicts.get('bullet:1')).toEqual({
			action: 'drop',
			reason: 'Frontend work, not data engineering.'
		});
	});

	it('ignores refs that are not on the shortlist', () => {
		// An invented ref must not become a decision about something else.
		const candidates = [bullet(1, 0.9)];
		const { candidates: adjusted, verdicts } = applyModelOpinions(
			candidates,
			[{ ref: 'bullet:999', action: 'drop', reason: 'Made up.' }],
			FLOOR
		);
		expect(adjusted[0].score).toBe(0.9);
		expect(verdicts.size).toBe(0);
	});

	it('refuses to act on a pinned candidate', () => {
		// A skill the job requires is not the model's to remove — that rule is
		// enforced before the model is asked, and again on the way back.
		const skill = bullet(5, 1, { entityType: OVERRIDE_ENTITIES.skill, pinned: true });
		const { candidates: adjusted } = applyModelOpinions(
			[skill],
			[{ ref: 'skill:5', action: 'drop', reason: 'Trying it on.' }],
			FLOOR
		);
		expect(adjusted[0].score).toBe(1);
	});

	it('ignores a verdict that is neither keep nor drop', () => {
		const { candidates: adjusted } = applyModelOpinions(
			[bullet(1, 0.9)],
			[{ ref: 'bullet:1', action: 'maybe', reason: 'Unsure.' }],
			FLOOR
		);
		expect(adjusted[0].score).toBe(0.9);
	});
});

describe('applyVerdictReasons', () => {
	const decision = (action: 'include' | 'exclude', entityId: number, reason: string) => ({
		entityType: OVERRIDE_ENTITIES.achievement,
		entityId,
		action,
		sort: null,
		reason
	});

	it('gives a decision the model wording when they agree', () => {
		const decisions = [decision('exclude', 1, 'trimmed to fit the page')];
		applyVerdictReasons(
			decisions,
			new Map([['bullet:1', { action: 'drop', reason: 'Frontend work, not data engineering.' }]])
		);
		expect(decisions[0].reason).toBe('Frontend work, not data engineering.');
	});

	it('never argues the case for an item it removed', () => {
		// The page budget re-selects after the model has spoken, so a "keep" can
		// still lose its line. Quoting the model's defence beside the exclusion is
		// the document arguing with itself — seen on application 27.
		const decisions = [decision('exclude', 1, 'trimmed to fit the page')];
		applyVerdictReasons(
			decisions,
			new Map([['bullet:1', { action: 'keep', reason: 'Shows you ensured uptime.' }]])
		);
		expect(decisions[0].reason).toBe('trimmed to fit the page');
	});

	it('leaves a decision the model said nothing about alone', () => {
		const decisions = [decision('include', 9, 'earned its place on the page for this job')];
		applyVerdictReasons(decisions, new Map());
		expect(decisions[0].reason).toBe('earned its place on the page for this job');
	});
});

describe('shortlistFor', () => {
	const dropDecision = (id: number): Decision => ({
		entityType: OVERRIDE_ENTITIES.achievement,
		entityId: id,
		action: 'exclude',
		sort: null,
		reason: 'below floor'
	});

	it('puts the proposed drops first — they are the consequential decisions', () => {
		const candidates = [bullet(1, 0.95), bullet(2, 0.9), bullet(3, 0.05)];
		const lines = shortlistFor(candidates, [dropDecision(3)], FLOOR).split('\n');
		expect(lines[0]).toContain('bullet:3');
		expect(lines[0]).toContain('| drop');
	});

	it('then offers what sits closest to the floor, not what scores highest', () => {
		// The obvious keeps need no second opinion; the borderline ones do.
		const candidates = [bullet(1, 0.99), bullet(2, 0.52), bullet(3, 0.95)];
		const lines = shortlistFor(candidates, [], FLOOR).split('\n');
		expect(lines[0]).toContain('bullet:2');
	});

	it('never shows the model a pinned item', () => {
		const skill = bullet(5, 1, { entityType: OVERRIDE_ENTITIES.skill, pinned: true });
		expect(shortlistFor([skill, bullet(1, 0.9)], [], FLOOR)).not.toContain('skill:5');
	});

	it('flattens whitespace so one candidate is one line', () => {
		const messy = bullet(1, 0.9, { label: 'first line\n\tsecond   line' });
		expect(shortlistFor([messy], [], FLOOR).split('\n')).toHaveLength(1);
	});

	it('shows the model what an item says, not what it is called', () => {
		// Handed the name alone, the model called a Lit web-components library a
		// "likely unrelated hobby project" — against a job whose frontend is web
		// components. A project's name is the least informative thing about it.
		const project = bullet(7, 0.5, {
			entityType: OVERRIDE_ENTITIES.sideProject,
			label: 'LitState',
			detail: 'LitState — Reactive state management library for Lit Web Components.'
		});
		const line = shortlistFor([project], [], FLOOR);
		expect(line).toContain('Lit Web Components');
		expect(line.split('\n')).toHaveLength(1);
	});

	it('keeps a long summary from turning the shortlist into a document', () => {
		const project = bullet(7, 0.5, {
			entityType: OVERRIDE_ENTITIES.sideProject,
			label: 'Verbose',
			detail: 'x'.repeat(900)
		});
		expect(shortlistFor([project], [], FLOOR).length).toBeLessThan(400);
	});
});

describe('buildCandidates: side projects', () => {
	const profileWith = (projects: Array<{ id: number; name: string; summary: string }>) =>
		({
			profile_versions: [{ id: 1, slug: 'base', extension_links: [], toggles: [], overrides: [] }],
			work_experiences: [],
			side_projects: projects.map((p) => ({ ...p, tags: null, end_date: null })),
			tech_skill_categories: []
		}) as unknown as Parameters<typeof buildCandidates>[0];

	it('carries the summary as detail and keeps the label a name', () => {
		// The label is what the review diff lists; the detail is what the ranker
		// embeds and the model reads. Before this, both were the name.
		const [project] = buildCandidates(
			profileWith([
				{ id: 7, name: 'LitState', summary: 'State management for Lit Web Components.' }
			]),
			'resume',
			'base',
			[]
		).filter((c) => c.entityType === OVERRIDE_ENTITIES.sideProject);
		expect(project.label).toBe('LitState');
		expect(project.detail).toBe('LitState — State management for Lit Web Components.');
	});

	it('falls back to the name when there is no summary', () => {
		const [project] = buildCandidates(
			profileWith([{ id: 7, name: 'LitState', summary: '' }]),
			'resume',
			'base',
			[]
		).filter((c) => c.entityType === OVERRIDE_ENTITIES.sideProject);
		expect(project.detail).toBe('LitState');
	});
});

describe('buildCandidates: why a role is hidden', () => {
	type Role = { id: number; position: string; name: string; tags?: string[] | null };
	const profileWith = (roles: Role[]) =>
		({
			profile_versions: [
				{ id: 1, slug: 'base', extension_links: [], toggles: [], overrides: [] },
				{ id: 2, slug: 'other', extension_links: [], toggles: [], overrides: [] }
			],
			work_experiences: roles.map((r) => ({
				...r,
				tags: r.tags ?? null,
				start_date: '2020-01-01',
				end_date: null,
				work_experience_achievements: [
					{ id: r.id * 100, description: `what ${r.position} did`, tags: null }
				]
			})),
			side_projects: [],
			tech_skill_categories: []
		}) as unknown as Parameters<typeof buildCandidates>[0];

	const holdOn = (roles: Role[], roleId: number) =>
		buildCandidates(profileWith(roles), 'resume', 'base', []).find(
			(c) => c.entityType === OVERRIDE_ENTITIES.achievement && c.parentId === roleId
		)?.parentHeldBack;

	const SHOWN = { id: 1, position: 'Engineer', name: 'Acme' };

	it('calls a whitelist naming another version what it is', () => {
		// Not a statement about this document: the applicant said "show it on
		// other", and a job-tailored version is as entitled to it as other was.
		expect(
			holdOn([SHOWN, { id: 2, position: 'Engineer', name: 'Other Co', tags: ['other'] }], 2)
		).toBe('version');
	});

	it('keeps "CV only" and profile-only apart from it, and from each other', () => {
		expect(holdOn([SHOWN, { id: 2, position: 'Dev', name: 'Old Co', tags: ['cv'] }], 2)).toBe(
			'template'
		);
		expect(
			holdOn([SHOWN, { id: 2, position: 'Dev', name: 'Old Co', tags: ['!resume', '!cv'] }], 2)
		).toBe('profile');
	});

	it('recognises a second write-up of a role already on the page', () => {
		// Same job, two tellings, one per version. Restoring the hidden one puts
		// the same job on the page twice under the same name.
		expect(holdOn([SHOWN, { id: 2, position: 'Engineer', name: 'Acme', tags: ['other'] }], 2)).toBe(
			'alternative'
		);
	});

	it('says nothing about a role that prints', () => {
		expect(holdOn([SHOWN], 1)).toBeUndefined();
	});

	it('carries what a restored role would bring with it', () => {
		const built = buildCandidates(
			profileWith([SHOWN, { id: 2, position: 'Dev', name: 'Other Co', tags: ['other'] }]),
			'resume',
			'base',
			[]
		);
		const hidden = built.find((c) => c.parentId === 2);
		// Hidden by its role, not by itself — so it prints the moment the role does.
		expect(hidden).toMatchObject({
			visible: false,
			parentVisible: false,
			visibleIfParentShown: true,
			parentType: OVERRIDE_ENTITIES.workExperience
		});
	});
});

describe('buildCandidates: skills', () => {
	type Skill = { id: number; name: string; tags?: string[] | null };
	const profileWith = (
		categories: Array<{ id: number; tags?: string[] | null; skills: Skill[] }>
	) =>
		({
			profile_versions: [{ id: 1, slug: 'base', extension_links: [], toggles: [], overrides: [] }],
			work_experiences: [],
			side_projects: [],
			tech_skill_categories: categories.map((c) => ({
				id: c.id,
				tags: c.tags ?? null,
				tech_skills: c.skills.map((s) => ({ ...s, tags: s.tags ?? null }))
			}))
		}) as unknown as Parameters<typeof buildCandidates>[0];

	const skills = (profile: Parameters<typeof buildCandidates>[0]) =>
		buildCandidates(profile, 'resume', 'base', ['Python', 'SQL']).filter(
			(c) => c.entityType === OVERRIDE_ENTITIES.skill
		);

	it('reads visibility by name, not by row', () => {
		// The same skill in two categories — one per version — is a real shape,
		// and a reader sees the word, not which row printed it. Asking per row
		// produced "now showing: Python" on a document already printing Python.
		const found = skills(
			profileWith([
				{ id: 1, skills: [{ id: 10, name: 'Python' }] },
				{ id: 2, tags: ['other-version'], skills: [{ id: 20, name: 'Python' }] }
			])
		);
		expect(found).toHaveLength(1);
		expect(found[0].visible).toBe(true);
	});

	it('says nothing about a skill only an invisible category holds', () => {
		// Including it would print nothing: the category is filtered first.
		expect(
			skills(
				profileWith([{ id: 2, tags: ['other-version'], skills: [{ id: 20, name: 'Python' }] }])
			)
		).toEqual([]);
	});

	it('still pins a held-back skill its category would print', () => {
		const found = skills(
			profileWith([{ id: 1, skills: [{ id: 10, name: 'Python', tags: ['!resume', '!cv'] }] }])
		);
		expect(found).toHaveLength(1);
		expect(found[0]).toMatchObject({ entityId: 10, visible: false, pinned: true });
	});

	it('slots a surfaced skill after the skills built on its name', () => {
		// "SQL" added last in the category would print after MongoDB, three lines
		// below the cluster it belongs to.
		const found = skills(
			profileWith([
				{
					id: 1,
					skills: [
						{ id: 1, name: 'PostgreSQL' },
						{ id: 2, name: 'MySQL' },
						{ id: 3, name: 'SQL optimization' },
						{ id: 4, name: 'MongoDB' },
						{ id: 5, name: 'SQL', tags: ['!resume', '!cv'] }
					]
				}
			])
		);
		// Three siblings print ahead of it; the anchor is the index after the last
		// one whose name carries the word.
		expect(found[0]).toMatchObject({ entityId: 5, visible: false, anchor: 3 });
	});

	it('appends when nothing in the category shares the word', () => {
		const found = skills(
			profileWith([
				{
					id: 1,
					skills: [
						{ id: 1, name: 'Django' },
						{ id: 5, name: 'Python', tags: ['!resume', '!cv'] }
					]
				}
			])
		);
		// Django is a Python framework, which only an embedding knows. No anchor
		// beats a wrong one.
		expect(found[0]).toMatchObject({ entityId: 5, anchor: null });
	});

	it('does not mistake a compound for the word it contains', () => {
		const found = skills(
			profileWith([
				{
					id: 1,
					skills: [
						{ id: 1, name: 'MySQL' },
						{ id: 2, name: 'PostgreSQL' },
						{ id: 5, name: 'SQL', tags: ['!resume', '!cv'] }
					]
				}
			])
		);
		expect(found[0].anchor).toBeNull();
	});

	it('pins one row per name, not one per copy', () => {
		const found = skills(
			profileWith([
				{ id: 1, skills: [{ id: 10, name: 'Python', tags: ['!resume', '!cv'] }] },
				{ id: 2, skills: [{ id: 20, name: 'python', tags: ['!resume', '!cv'] }] }
			])
		);
		expect(found).toHaveLength(1);
		expect(found[0].visible).toBe(false);
	});
});

describe('buildCandidates: a required skill the page already shows under another name', () => {
	// The applicant keeps the long spelling off their documents and prints the
	// acronym. A posting that used BOTH — this one did — put each on the required
	// list, and the pass surfaced the hidden twin to satisfy a requirement its own
	// visible sibling already met. The document printed the same skill twice.
	const profileWithSkills = (skills: Array<{ id: number; name: string; tags: string[] | null }>) =>
		({
			profile_versions: [{ id: 1, slug: 'base', extension_links: [], toggles: [], overrides: [] }],
			work_experiences: [],
			side_projects: [],
			tech_skill_categories: [{ id: 1, name: 'AI', tags: null, tech_skills: skills }]
		}) as unknown as Parameters<typeof buildCandidates>[0];

	const PAIR = [
		{ id: 10, name: 'RAG', tags: null },
		{ id: 11, name: 'Retrieval Augmented Generation', tags: ['!resume', '!cv'] }
	];
	// What resolveConcepts answers for that pair: `rag` is an approved alias of
	// the long form, so both names key onto one concept slug.
	const RESOLVED = new Map([
		['rag', 'retrievalaugmentedgeneration'],
		['retrievalaugmentedgeneration', 'retrievalaugmentedgeneration']
	]);
	const pin = (conceptOf?: Map<string, string>) =>
		buildCandidates(
			profileWithSkills(PAIR),
			'resume',
			'base',
			['RAG', 'Retrieval Augmented Generation'],
			conceptOf
		).find((c) => c.entityType === OVERRIDE_ENTITIES.skill && c.label.startsWith('Retrieval'));

	it('adds the hidden spelling when nothing tells it the two are one skill', () => {
		expect(pin()?.pinned).toBe(true);
		expect(pin()?.visible).toBe(false);
	});

	it('leaves it alone once the graph says they resolve to the same concept', () => {
		// `visible` means "the document already shows this" — true, under another
		// name — so the selector emits no row and nothing is added.
		expect(pin(RESOLVED)?.visible).toBe(true);
	});

	it('still adds a required skill the page genuinely lacks', () => {
		const found = buildCandidates(
			profileWithSkills([
				{ id: 10, name: 'RAG', tags: null },
				{ id: 12, name: 'Ontologies', tags: ['!resume', '!cv'] }
			]),
			'resume',
			'base',
			['Ontologies'],
			new Map([...RESOLVED, ['ontologies', 'ontologies']])
		).find((c) => c.entityType === OVERRIDE_ENTITIES.skill && c.label === 'Ontologies');
		expect(found?.pinned).toBe(true);
		expect(found?.visible).toBe(false);
	});
});

describe('buildCandidates: a required skill the page already shows at a role', () => {
	// The skills block is not the only list of skill names on the page. This
	// profile keeps Kafka off its skills block on purpose and records it where it
	// was used; a template that prints a role's TECH line prints it there. Asking
	// only the skills block called it missing, then wrote an include whose whole
	// effect was to print the word a second time — against the applicant's own
	// hold-back.
	const profileWith = (
		roleTech: Array<{ id: number; name: string; tags?: string[] | null }>,
		roleTags: string[] | null = null
	) =>
		({
			profile_versions: [{ id: 1, slug: 'base', extension_links: [], toggles: [], overrides: [] }],
			work_experiences: [
				{
					id: 1,
					position: 'Engineer',
					name: 'Acme',
					start_date: '2020-01-01',
					end_date: null,
					tags: roleTags,
					work_experience_achievements: [],
					work_experience_technologies: roleTech.map((t) => ({ ...t, tags: t.tags ?? null }))
				}
			],
			side_projects: [],
			tech_skill_categories: [
				{
					id: 1,
					name: 'Backend',
					tags: null,
					tech_skills: [
						{ id: 10, name: 'Python', tags: null },
						{ id: 11, name: 'Kafka', tags: ['!resume', '!cv'] }
					]
				}
			]
		}) as unknown as Parameters<typeof buildCandidates>[0];

	const kafka = (profile: Parameters<typeof buildCandidates>[0], template: string | null = null) =>
		buildCandidates(profile, 'resume', 'base', ['Kafka'], undefined, template).find(
			(c) => c.entityType === OVERRIDE_ENTITIES.skill && c.label === 'Kafka'
		);

	const TECH = [{ id: 100, name: 'Kafka' }];

	it('leaves it alone on a template that prints the tech line', () => {
		// `visible` is "the document already shows this", answered by name — the
		// same reading that stops a skill held in two categories being added twice.
		expect(kafka(profileWith(TECH), 'citrus')).toMatchObject({ pinned: true, visible: true });
	});

	it('still surfaces it on the layout that prints no technologies', () => {
		// The built-in default renders no TECH line anywhere, so on that document
		// the word really is missing and the skills block is the only way to say it.
		expect(kafka(profileWith(TECH))).toMatchObject({ pinned: true, visible: false });
		expect(kafka(profileWith(TECH), 'default')).toMatchObject({ visible: false });
	});

	it('does not read a tech line off a role the document omits', () => {
		// The role is filtered before its technologies are, exactly as the renderer
		// does it — a hidden role takes its whole TECH list with it.
		expect(kafka(profileWith(TECH, ['other-version']), 'citrus')?.visible).toBe(false);
	});

	it('honours a technology held back on this document', () => {
		expect(kafka(profileWith([{ id: 100, name: 'Kafka', tags: ['cv'] }]), 'citrus')?.visible).toBe(
			false
		);
	});

	it('makes each printed technology a candidate the run can decide about', () => {
		// Zero chars and no score: it is kept or dropped on `covers` alone. A bare
		// name has nothing for an embedding to read, which is the same objection
		// that keeps individual skills include-only.
		const techs = buildCandidates(
			profileWith([
				{ id: 100, name: 'Kafka' },
				{ id: 101, name: 'Varnish' }
			]),
			'resume',
			'base',
			['Kafka'],
			undefined,
			'citrus'
		).filter((c) => c.entityType === OVERRIDE_ENTITIES.technology);
		expect(techs.map((c) => c.label)).toEqual(['Kafka', 'Varnish']);
		expect(techs[0]).toMatchObject({
			entityId: 100,
			parentId: 1,
			chars: 0,
			visible: true,
			score: 0
		});
	});

	it('offers none of them on a template that prints no tech line', () => {
		// Nothing to decide about something the document does not show, and a row
		// saying otherwise would claim a change the applicant cannot see.
		expect(
			buildCandidates(profileWith(TECH), 'resume', 'base', ['Kafka']).filter(
				(c) => c.entityType === OVERRIDE_ENTITIES.technology
			)
		).toEqual([]);
	});

	it('does not let a tech name anchor a skill inside a category', () => {
		// An anchor is an index into ONE category's rendered list. A name from a
		// role's tech line has no position there, and using it as one would slot
		// the surfaced skill where nothing is.
		const found = kafka(profileWith([{ id: 100, name: 'Kafka Streams' }]), 'citrus');
		expect(found?.visible).toBe(false);
		expect(found?.anchor).toBeNull();
		// It is still on the page inside a longer name, which the reason says.
		expect(found?.carriedBy).toBe('Kafka Streams');
	});
});

describe('markCoverage: what the applicant holds, and where it is written down', () => {
	// A requirement is answered by the words an item says, and the graph is what
	// knows PostgreSQL answers SQL. What it can answer for is whatever it was
	// seeded with — and the seed used to be the skills block alone, so a profile
	// that records a technology against the role where it was used held it as far
	// as this pass was concerned nowhere at all.
	const profile = {
		tech_skill_categories: [{ tech_skills: [{ name: 'Python' }] }],
		work_experiences: [
			{
				work_experience_technologies: [{ name: 'PostgreSQL' }],
				work_experience_projects: [
					{ work_experience_project_technologies: [{ name: 'Kubernetes' }] }
				]
			}
		],
		side_projects: [{ side_project_technologies: [{ name: 'Svelte' }] }]
	};

	const bulletSaying = (text: string): Candidate => ({
		entityType: OVERRIDE_ENTITIES.achievement,
		entityId: 1,
		parentId: 1,
		label: text,
		chars: text.length,
		visible: true,
		pinned: false,
		score: 0
	});

	beforeEach(() => {
		vi.mocked(expandUpwardBySeed).mockReset();
		vi.mocked(expandUpwardBySeed).mockResolvedValue(new Map());
	});

	it('seeds the graph with every place a skill name is written down', async () => {
		await markCoverage([bulletSaying('did things')], profile, ['SQL']);
		expect(vi.mocked(expandUpwardBySeed).mock.calls[0][0].sort()).toEqual([
			'Kubernetes',
			'PostgreSQL',
			'Python',
			'Svelte'
		]);
	});

	it('credits a bullet naming a technology the profile only lists at a role', async () => {
		// Upward only: PostgreSQL reaches SQL, and a SQL requirement is answered.
		vi.mocked(expandUpwardBySeed).mockResolvedValue(
			new Map([['postgresql', [{ slug: 'sql' }]]]) as never
		);
		const bullet = bulletSaying('Cut checkout latency by tuning PostgreSQL');
		await markCoverage([bullet], profile, ['SQL']);
		expect(bullet.covers).toEqual(['SQL']);
	});

	it('still reads a requirement spelled out, when the graph cannot be reached', async () => {
		vi.mocked(expandUpwardBySeed).mockRejectedValue(new Error('graph down'));
		const bullet = bulletSaying('Ran the Python side of the pipeline');
		await markCoverage([bullet], profile, ['Python']);
		expect(bullet.covers).toEqual(['Python']);
	});
});
