import { describe, expect, it } from 'vitest';
import { DEFAULT_SELECTION, selectForJob, surfaceBar, type Candidate } from './tailoring';
import { OVERRIDE_ENTITIES } from './version-overrides';

function bullet(
	id: number,
	roleId: number,
	score: number,
	over: Partial<Candidate> = {}
): Candidate {
	return {
		entityType: OVERRIDE_ENTITIES.achievement,
		entityId: id,
		parentId: roleId,
		label: `bullet ${id}`,
		chars: 100,
		visible: true,
		pinned: false,
		score,
		...over
	};
}

const OPTS = { floor: 0.3, ...DEFAULT_SELECTION };

describe('selectForJob', () => {
	it('returns nothing when everything is relevant and fits', () => {
		const candidates = [bullet(1, 10, 0.8), bullet(2, 10, 0.7), bullet(3, 10, 0.6)];
		expect(selectForJob(candidates, OPTS)).toEqual([]);
	});

	it('includes a required skill the document would hide', () => {
		const candidates: Candidate[] = [
			{
				entityType: OVERRIDE_ENTITIES.skill,
				entityId: 5,
				parentId: 2,
				label: 'Kubernetes',
				chars: 12,
				visible: false,
				pinned: true,
				score: 0.9
			}
		];
		const decisions = selectForJob(candidates, {
			...OPTS,
			pinnedReason: (c) => `this job requires ${c.label}`
		});
		expect(decisions).toEqual([
			{
				entityType: OVERRIDE_ENTITIES.skill,
				entityId: 5,
				action: 'include',
				sort: null,
				reason: 'this job requires Kubernetes'
			}
		]);
	});

	it('keeps an irrelevant bullet when the page has room for it', () => {
		// It used to go on score alone. Dropping it bought nothing — the document
		// was a third of a page either way — and doing that to every weak line is
		// how a 26-item resume became an 8-item one.
		const candidates = [
			bullet(1, 10, 0.9),
			bullet(2, 10, 0.8),
			bullet(3, 10, 0.7),
			bullet(4, 10, 0.05)
		];
		expect(selectForJob(candidates, OPTS)).toEqual([]);
	});

	it('drops the least relevant first once the page is full', () => {
		const candidates = [
			bullet(1, 10, 0.9),
			bullet(2, 10, 0.8),
			bullet(3, 10, 0.7),
			bullet(4, 10, 0.05)
		];
		// Four bullets at 100 chars; room for three.
		const decisions = selectForJob(candidates, { ...OPTS, budgetChars: 320 });
		expect(decisions).toHaveLength(1);
		expect(decisions[0]).toMatchObject({ entityId: 4, action: 'exclude' });
	});

	it('stops trimming as soon as it fits, however weak the rest', () => {
		const candidates = [
			bullet(1, 10, 0.9),
			bullet(2, 10, 0.02),
			bullet(3, 10, 0.01),
			bullet(4, 10, 0.0)
		];
		const decisions = selectForJob(candidates, { ...OPTS, budgetChars: 320 });
		expect(decisions.filter((d) => d.action === 'exclude')).toHaveLength(1);
		expect(decisions[0]).toMatchObject({ entityId: 4 });
	});

	it('never empties a role, however small the page', () => {
		// Every bullet is irrelevant and the page is far too small for them, but a
		// role listed with nothing under it reads as padding — the floor on
		// siblings wins over the page.
		const candidates = [bullet(1, 10, 0.01), bullet(2, 10, 0.01), bullet(3, 10, 0.01)];
		const decisions = selectForJob(candidates, { ...OPTS, budgetChars: 10 });
		expect(decisions.filter((d) => d.action === 'exclude')).toHaveLength(
			candidates.length - DEFAULT_SELECTION.minPerParent
		);
	});

	it('spends the floor only when the page has run out', () => {
		// It is a floor, not a target: three bullets that fit are three bullets.
		const candidates = [bullet(1, 10, 0.01), bullet(2, 10, 0.01), bullet(3, 10, 0.01)];
		expect(selectForJob(candidates, { ...OPTS, budgetChars: 10_000 })).toEqual([]);
	});

	it('never drops a role or an education, however irrelevant', () => {
		// Not a policy check — roles simply are not in the droppable set, so there
		// is no path that emits an exclusion for one.
		const candidates: Candidate[] = [
			{
				entityType: OVERRIDE_ENTITIES.workExperience,
				entityId: 1,
				parentId: null,
				label: 'Bartender',
				chars: 400,
				visible: true,
				pinned: false,
				score: 0
			},
			{
				entityType: OVERRIDE_ENTITIES.education,
				entityId: 2,
				parentId: null,
				label: 'BSc',
				chars: 200,
				visible: true,
				pinned: false,
				score: 0
			}
		];
		expect(selectForJob(candidates, { ...OPTS, budgetChars: 10 })).toEqual([]);
	});

	it('keeps one side project rather than emptying the section', () => {
		const project = (id: number, score: number): Candidate => ({
			entityType: OVERRIDE_ENTITIES.sideProject,
			entityId: id,
			parentId: null,
			label: `project ${id}`,
			chars: 150,
			visible: true,
			pinned: false,
			score
		});
		const decisions = selectForJob([project(1, 0.02), project(2, 0.01)], {
			...OPTS,
			budgetChars: 10
		});
		expect(decisions.filter((d) => d.action === 'exclude')).toHaveLength(1);
	});

	it('trims to the page budget once relevance has had its say', () => {
		const candidates = [
			bullet(1, 10, 0.9, { chars: 500 }),
			bullet(2, 10, 0.8, { chars: 500 }),
			bullet(3, 10, 0.7, { chars: 500 }),
			bullet(4, 10, 0.6, { chars: 500 })
		];
		const decisions = selectForJob(candidates, { ...OPTS, budgetChars: 1500 });
		const excluded = decisions.filter((d) => d.action === 'exclude');
		expect(excluded).toHaveLength(1);
		// The least relevant one goes first, and it says why.
		expect(excluded[0].entityId).toBe(4);
		expect(excluded[0].reason).toContain('trimmed to fit the page');
	});

	it('promotes what speaks to the job instead of re-sorting the whole role', () => {
		// Two rows, not one per bullet: the rest keep the applicant's own order,
		// because orderByOverrides leaves unsorted items behind the sorted ones.
		const candidates = [bullet(1, 10, 0.4), bullet(2, 10, 0.9), bullet(3, 10, 0.6)];
		const decisions = selectForJob(candidates, OPTS);
		expect(decisions.map((d) => [d.entityId, d.sort])).toEqual([
			[2, 0],
			[3, 1]
		]);
		expect(decisions[0].reason).toBe(
			'the most relevant thing you have for this job — moved to the top'
		);
	});

	it('promotes nothing when every bullet is below the relevance floor', () => {
		// Ordering on scores that mean nothing would overrule an order the
		// applicant chose deliberately.
		const candidates = [bullet(1, 10, 0.1), bullet(2, 10, 0.2), bullet(3, 10, 0.15)];
		expect(selectForJob(candidates, OPTS).filter((d) => d.sort !== null)).toEqual([]);
	});

	it('emits no ordering rows when the profile order already leads with the best', () => {
		const candidates = [bullet(1, 10, 0.9), bullet(2, 10, 0.5)];
		expect(selectForJob(candidates, OPTS)).toEqual([]);
	});

	it('does not emit an exclusion for something the base version never printed', () => {
		// It is already absent; a row saying so would be noise in the diff.
		const candidates = [
			bullet(1, 10, 0.9),
			bullet(2, 10, 0.8),
			bullet(3, 10, 0.7),
			bullet(4, 10, 0.01, { visible: false })
		];
		expect(selectForJob(candidates, OPTS)).toEqual([]);
	});
});

describe('surfacing hidden evidence', () => {
	const hidden = (id: number, score: number, over: Partial<Candidate> = {}) =>
		bullet(id, 10, score, { visible: false, ...over });

	it('adds back a hidden bullet that outranks half of what prints', () => {
		// The reported case: a bullet tagged onto the applicant's other versions,
		// hidden here, and the best proof this job has. Before this, tailoring
		// could only ever take things away.
		const decisions = selectForJob(
			[bullet(1, 10, 0.2), bullet(2, 10, 0.3), bullet(3, 10, 0.4), hidden(9, 0.9)],
			OPTS
		);
		expect(decisions).toContainEqual(
			expect.objectContaining({ entityId: 9, action: 'include', sort: null })
		);
	});

	it('leaves a hidden bullet alone when it is no better than what prints', () => {
		const decisions = selectForJob(
			[bullet(1, 10, 0.8), bullet(2, 10, 0.9), bullet(3, 10, 0.95), hidden(9, 0.6)],
			OPTS
		);
		expect(decisions.some((d) => d.entityId === 9)).toBe(false);
	});

	it('will not surface a bullet whose role the document drops', () => {
		// Including it prints nothing — the role is filtered before its bullets,
		// so the decision would claim a change that never happens.
		const decisions = selectForJob(
			[
				bullet(1, 10, 0.2),
				bullet(2, 10, 0.3),
				bullet(3, 10, 0.4),
				hidden(9, 0.9, { parentVisible: false })
			],
			OPTS
		);
		expect(decisions.some((d) => d.entityId === 9)).toBe(false);
	});

	it('lets a CV-only item earn a place on a targeted resume', () => {
		// The tag means "too much detail for a short document" — a judgement about
		// focus, which is the one a targeted resume is entitled to revisit. It
		// still has to outrank half the page, and the budget still charges
		// something weaker for the space.
		const decisions = selectForJob(
			[
				bullet(1, 10, 0.2),
				bullet(2, 10, 0.3),
				bullet(3, 10, 0.4),
				hidden(9, 0.9, { templateHeldBack: true })
			],
			OPTS
		);
		expect(decisions).toContainEqual(expect.objectContaining({ entityId: 9, action: 'include' }));
	});

	it('surfaces the best few rather than everything above the bar', () => {
		const decisions = selectForJob(
			[
				bullet(1, 10, 0.1),
				bullet(2, 10, 0.2),
				bullet(3, 10, 0.3),
				...[0.9, 0.85, 0.8, 0.75, 0.7].map((score, i) => hidden(10 + i, score))
			],
			OPTS
		);
		const added = decisions.filter((d) => d.action === 'include' && d.entityId >= 10);
		expect(added.map((d) => d.entityId).sort((a, z) => a - z)).toEqual([10, 11, 12]);
	});

	it('does not drop what it just surfaced', () => {
		// It clears the bar by construction, but the page-budget pass must not
		// undo a decision the same run made.
		const decisions = selectForJob(
			[bullet(1, 10, 0.2), bullet(2, 10, 0.3), bullet(3, 10, 0.4), hidden(9, 0.9)],
			{ ...OPTS, budgetChars: 1 }
		);
		expect(decisions.some((d) => d.entityId === 9 && d.action === 'exclude')).toBe(false);
	});
});

describe('surfaceBar', () => {
	it('is the median of what prints, never below the floor', () => {
		const candidates = [bullet(1, 10, 0.2), bullet(2, 10, 0.6), bullet(3, 10, 0.8)];
		expect(surfaceBar(candidates, 0.1)).toBeCloseTo(0.6);
		expect(surfaceBar(candidates, 0.9)).toBeCloseTo(0.9);
	});

	it('ignores what the document does not print', () => {
		const candidates = [bullet(1, 10, 0.6), bullet(2, 10, 0.01, { visible: false })];
		expect(surfaceBar(candidates, 0)).toBeCloseTo(0.6);
	});

	it('falls back to the floor when nothing prints', () => {
		expect(surfaceBar([], 0.5)).toBe(0.5);
	});
});

describe('skill groups', () => {
	const group = (id: number, score: number, over: Partial<Candidate> = {}): Candidate => ({
		entityType: OVERRIDE_ENTITIES.skillCategory,
		entityId: id,
		parentId: null,
		label: `group ${id}: a, b, c`,
		chars: 0,
		visible: true,
		pinned: false,
		score,
		...over
	});

	it('drops a group this job has no use for', () => {
		const decisions = selectForJob(
			[group(1, 0.9), group(2, 0.8), group(3, 0.7), group(4, 0.05)],
			OPTS
		);
		expect(decisions).toEqual([
			expect.objectContaining({
				entityId: 4,
				entityType: OVERRIDE_ENTITIES.skillCategory,
				action: 'exclude'
			})
		]);
	});

	it('never drops a group holding a skill this job requires', () => {
		// The filter reaches the category before the skills inside it, so this
		// would take the required skill off the page with it.
		const decisions = selectForJob(
			[group(1, 0.9), group(2, 0.9), group(3, 0.01, { pinned: true })],
			OPTS
		);
		expect(decisions).toEqual([]);
	});

	it('keeps a floor of groups, so the section cannot vanish', () => {
		const decisions = selectForJob([group(1, 0.01), group(2, 0.01), group(3, 0.01)], OPTS);
		expect(decisions.filter((d) => d.action === 'exclude')).toHaveLength(1);
	});

	it('does not spend the page budget on them', () => {
		// Their chars are zero: a group costs a line either way, and counting it
		// would silently re-tune how much prose survives.
		const decisions = selectForJob([group(1, 0.9), group(2, 0.9), group(3, 0.9)], {
			...OPTS,
			budgetChars: 0
		});
		expect(decisions).toEqual([]);
	});
});
