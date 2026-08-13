import { describe, expect, it } from 'vitest';
import {
	beyondReach,
	canBringBack,
	canSurface,
	chooseBudget,
	HOLD_BACK_PENALTY,
	RECENCY_GRACE,
	RECENCY_PENALTY,
	surfaceScore,
	DEFAULT_SELECTION,
	PAGE_BUDGETS,
	PROMOTION_MARGIN,
	promotionsFor,
	tightenBudget,
	selectForJob,
	surfaceBar,
	type Candidate
} from './tailoring';
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

const OPTS = {
	floor: 0.3,
	promotionMargin: PROMOTION_MARGIN.semantic,
	...DEFAULT_SELECTION
};

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

	it('leaves an order alone when relevance barely disagrees with it', () => {
		// Both clear the floor and both are relevant; the difference between them
		// is a hundredth. Moving on that writes "the most relevant thing you have
		// for this job" about a gap nobody could see, and overrules an order the
		// applicant chose — the cap keeps the diff short, this keeps it true.
		const candidates = [bullet(1, 10, 0.55), bullet(2, 10, 0.56), bullet(3, 10, 0.555)];
		expect(selectForJob(candidates, OPTS).filter((d) => d.sort !== null)).toEqual([]);
	});

	it('measures each promotion against what it actually displaces', () => {
		// After bullet 2 moves to the top, position 1 holds bullet 1 — not bullet
		// 2, which has left. Comparing against the original occupant would ask
		// whether 0.6 beats 0.9 and stop, burying the second-best bullet.
		const candidates = [bullet(1, 10, 0.4), bullet(2, 10, 0.9), bullet(3, 10, 0.6)];
		expect(
			selectForJob(candidates, OPTS)
				.filter((d) => d.sort !== null)
				.map((d) => [d.entityId, d.sort])
		).toEqual([
			[2, 0],
			[3, 1]
		]);
	});

	it('promotes more from a long role than from a short one', () => {
		// Two of eleven leaves the third-best thing you did there in fifth place,
		// where a reader who skims the first lines never reaches it.
		expect(promotionsFor(3)).toBe(2);
		expect(promotionsFor(11)).toBe(3);
		expect(promotionsFor(13)).toBe(4);
		// Still a handful of rows, never a re-sort.
		expect(promotionsFor(60)).toBe(4);

		const many = Array.from({ length: 12 }, (_, i) => bullet(i + 1, 10, 0.4));
		const candidates = [...many, bullet(90, 10, 0.9), bullet(91, 10, 0.8), bullet(92, 10, 0.7)];
		const promoted = selectForJob(candidates, OPTS).filter((d) => d.sort !== null);
		expect(promoted.map((d) => d.entityId)).toEqual([90, 91, 92]);
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

	it('leaves a hidden bullet alone when it is not related to the job', () => {
		// The threshold is the relevance floor, which comes from the embedding
		// model. It used to be the median of what the base version prints — so a
		// narrower base raised its own bar and kept more out, which made a generic
		// version's whitelist decide the contents of a per-job document.
		const decisions = selectForJob(
			[bullet(1, 10, 0.8), bullet(2, 10, 0.9), bullet(3, 10, 0.95), hidden(9, 0.2)],
			OPTS
		);
		expect(decisions.some((d) => d.entityId === 9)).toBe(false);
	});

	it('adds a hidden bullet the base outranks, when it is related and there is room', () => {
		// Worse than everything printed and still worth having: the page has room,
		// and "my Django version does not carry this" is not an answer about this
		// job.
		const decisions = selectForJob(
			[bullet(1, 10, 0.8), bullet(2, 10, 0.9), bullet(3, 10, 0.95), hidden(9, 0.4)],
			OPTS
		);
		expect(decisions).toContainEqual(expect.objectContaining({ entityId: 9, action: 'include' }));
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

	it('surfaces everything above the bar when the page has room', () => {
		// There was a cap of three here, on the reasoning that wanting more meant
		// the base was the wrong version. Version tags answer for a CLASS of jobs;
		// tailoring exists because this job is not a class.
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
		expect(added.map((d) => d.entityId).sort((a, z) => a - z)).toEqual([10, 11, 12, 13, 14]);
	});

	it('makes a surfaced item earn the page like anything else', () => {
		// Room for three. Five want in on top of three the base shows — so the
		// page has to be the limit, and it has to be able to say no to an
		// addition. While surfaced items were exempt from the trim, a document
		// could be gutted to fit its own extras.
		const decisions = selectForJob(
			[
				bullet(1, 10, 0.1, { chars: 100 }),
				bullet(2, 10, 0.2, { chars: 100 }),
				bullet(3, 10, 0.3, { chars: 100 }),
				...[0.9, 0.85, 0.8, 0.75, 0.7].map((score, i) => hidden(10 + i, score, { chars: 100 }))
			],
			{ ...OPTS, budgetChars: 300 }
		);
		const added = decisions
			.filter((d) => d.action === 'include')
			.map((d) => d.entityId)
			.sort((a, z) => a - z);
		// The two weakest additions lost to the page and leave no trace: an
		// include row for an item that never printed is a claim you can check.
		expect(added).toEqual([10, 11, 12]);
		expect(decisions.some((d) => d.entityId === 13)).toBe(false);
		expect(decisions.some((d) => d.entityId === 14)).toBe(false);
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

describe('canSurface', () => {
	it('passes a hidden bullet on a role the document prints', () => {
		expect(canSurface(bullet(1, 10, 0.9, { visible: false, parentVisible: true }))).toBe(true);
	});

	it('refuses one whose role the document leaves out', () => {
		// The role is filtered before its bullets are, so showing the bullet is not
		// something an override can do — and offering it is worse than silence.
		expect(canSurface(bullet(1, 10, 0.9, { visible: false, parentVisible: false }))).toBe(false);
	});

	it('treats a missing parent as nothing to worry about', () => {
		expect(canSurface(bullet(1, 10, 0.9, { visible: false }))).toBe(true);
	});

	it('says nothing about what already prints', () => {
		expect(canSurface(bullet(1, 10, 0.9))).toBe(false);
	});

	it('refuses what is not droppable, which is what surfacing is defined over', () => {
		expect(
			canSurface({
				entityType: OVERRIDE_ENTITIES.skill,
				entityId: 1,
				parentId: null,
				label: 'Django',
				chars: 10,
				visible: false,
				pinned: false,
				score: 0.9
			})
		).toBe(false);
	});
});

describe('surfacing respects the parent', () => {
	it("leaves a hidden role's bullet out of the diff however relevant it is", () => {
		const decisions = selectForJob(
			[
				bullet(1, 10, 0.4),
				bullet(2, 10, 0.5),
				// Off the resume because its role is, not because of its own tags.
				bullet(3, 11, 0.99, { visible: false, parentVisible: false })
			],
			OPTS
		);
		expect(decisions.some((d) => d.entityId === 3)).toBe(false);
	});
});

describe('canBringBack', () => {
	const onHiddenRole = (over: Partial<Candidate>) =>
		bullet(1, 10, 0.9, { visible: false, parentVisible: false, ...over });

	it('reaches a bullet whose role is hidden only by a version tag', () => {
		// "Show this on X" is not a statement about this document, and a run can
		// write the role's include in the same pass — which is the only reason
		// canSurface refuses the same item.
		expect(canBringBack(onHiddenRole({ parentHeldBack: 'version' }))).toBe(true);
		expect(canSurface(onHiddenRole({ parentHeldBack: 'version' }))).toBe(false);
	});

	it('leaves the applicant their own judgement about a role', () => {
		expect(canBringBack(onHiddenRole({ parentHeldBack: 'template' }))).toBe(false);
		expect(canBringBack(onHiddenRole({ parentHeldBack: 'profile' }))).toBe(false);
	});

	it('never puts the same job on the page twice', () => {
		expect(canBringBack(onHiddenRole({ parentHeldBack: 'alternative' }))).toBe(false);
	});

	it('defaults to the conservative answer when no reason is carried', () => {
		expect(canBringBack(onHiddenRole({}))).toBe(false);
	});

	it('agrees with canSurface about everything else', () => {
		expect(canBringBack(bullet(1, 10, 0.9, { visible: false, parentVisible: true }))).toBe(true);
		expect(canBringBack(bullet(1, 10, 0.9))).toBe(false);
	});
});

describe('bringing a role back with what it holds', () => {
	const role = OVERRIDE_ENTITIES.workExperience;
	const stranded = (over: Partial<Candidate> = {}) =>
		bullet(3, 11, 0.99, {
			visible: false,
			parentVisible: false,
			parentHeldBack: 'version',
			parentType: role,
			...over
		});
	const rowFor = (decisions: ReturnType<typeof selectForJob>, type: string, id: number) =>
		decisions.find((d) => d.entityType === type && d.entityId === id);

	it('includes the role, not just the bullet that earned it', () => {
		// Without the role's own row this is a decision that renders as nothing:
		// the filter meets the role first and never asks about the bullet.
		const decisions = selectForJob([bullet(1, 10, 0.5), bullet(2, 10, 0.5), stranded()], OPTS);
		expect(rowFor(decisions, OVERRIDE_ENTITIES.achievement, 3)?.action).toBe('include');
		expect(rowFor(decisions, role, 11)?.action).toBe('include');
	});

	it('says nothing about a role held off this document on purpose', () => {
		for (const hold of ['template', 'profile', 'alternative'] as const) {
			const decisions = selectForJob(
				[bullet(1, 10, 0.5), bullet(2, 10, 0.5), stranded({ parentHeldBack: hold })],
				OPTS
			);
			expect(rowFor(decisions, OVERRIDE_ENTITIES.achievement, 3)).toBeUndefined();
			expect(rowFor(decisions, role, 11)).toBeUndefined();
		}
	});

	it('spends the page budget on what rides along with the role', () => {
		// A sibling its own tags allow prints the moment the role does. Left out
		// of the budget it would arrive after the page was already full, which is
		// how a two-page document becomes three.
		// Below the floor, so it is not surfaced on its own merits — it is here
		// only because its role is.
		const rides = (id: number, score: number) =>
			bullet(id, 11, score, {
				visible: false,
				parentVisible: false,
				parentHeldBack: 'version',
				parentType: role,
				visibleIfParentShown: true
			});
		const tight = { ...OPTS, budgetChars: 250 };
		const decisions = selectForJob(
			[bullet(1, 10, 0.9), bullet(2, 10, 0.9), stranded(), rides(4, 0.1), rides(5, 0.12)],
			tight
		);
		// It is on the page, so trimming it has to be SAID — unlike an item the
		// base never printed, where an exclusion row would be noise.
		expect(rowFor(decisions, OVERRIDE_ENTITIES.achievement, 4)?.action).toBe('exclude');
	});
});

describe('beyondReach', () => {
	// floor 0.3, and the document's own median sits at 0.6 — the bar this has to
	// clear, the same one the evidence warning uses.
	const FLOOR = 0.3;
	const BAR = 0.6;
	const heldRole = (over: Partial<Candidate> = {}) =>
		bullet(1, 10, 0.9, {
			visible: false,
			parentVisible: false,
			parentHeldBack: 'template',
			parentType: OVERRIDE_ENTITIES.workExperience,
			...over
		});

	it('names a role held off this document that holds strong evidence', () => {
		expect(beyondReach(heldRole(), FLOOR, BAR)).toBe(true);
		expect(beyondReach(heldRole({ parentHeldBack: 'profile' }), FLOOR, BAR)).toBe(true);
	});

	it('asks for the median of what prints, not the floor', () => {
		// 0.45 is "somewhat about this job", which most of a career is. Arguing
		// with a decision on that is how a suggestion becomes noise.
		expect(beyondReach(heldRole({ score: 0.45 }), FLOOR, BAR)).toBe(false);
	});

	it('leaves an old role alone however well it scores', () => {
		// Measured on the profile this was built against: two roles ending in 2011
		// and 2013, named for "promoted to mid-level developer" against a Lead
		// Software Engineer post, on word overlap alone.
		expect(beyondReach(heldRole({ age: 0.66 }), FLOOR, BAR)).toBe(false);
		expect(beyondReach(heldRole({ age: 0.49 }), FLOOR, BAR)).toBe(true);
	});

	it('says nothing about a role a run can simply bring back', () => {
		expect(beyondReach(heldRole({ parentHeldBack: 'version' }), FLOOR, BAR)).toBe(false);
	});

	it('says nothing about an alternative write-up', () => {
		// The job is on the page already, under its other telling.
		expect(beyondReach(heldRole({ parentHeldBack: 'alternative' }), FLOOR, BAR)).toBe(false);
	});

	it('says nothing about what the document already prints', () => {
		expect(beyondReach(bullet(1, 10, 0.9), FLOOR, BAR)).toBe(false);
	});
});

describe('recency', () => {
	it('leaves an undated item alone', () => {
		const c = bullet(1, 10, 0.8);
		expect(surfaceScore(c)).toBeCloseTo(0.8);
	});

	it('discounts an old one, without ever zeroing it', () => {
		expect(surfaceScore(bullet(1, 10, 0.8, { age: 1 }))).toBeCloseTo(0.8 * (1 - RECENCY_PENALTY));
		expect(surfaceScore(bullet(1, 10, 0.8, { age: 1 }))).toBeGreaterThan(0);
	});

	it('leaves recent work untouched, not merely lightly touched', () => {
		// A role that ended last year scores about 0.07 on a twenty-year career,
		// and the lexical ranker's scores are small integers — so "a little" would
		// have been the whole decision at the bar.
		expect(surfaceScore(bullet(1, 10, 2, { age: 0.07 }), 1)).toBe(2);
		expect(surfaceScore(bullet(1, 10, 2, { age: RECENCY_GRACE }), 1)).toBe(2);
	});

	it('charges the margin above the floor, never the whole score', () => {
		// Cosine similarity does not start at zero: the floor is 0.50 and a real
		// job's bar measured 0.55. Charging the whole score took a 0.58 item to
		// 0.435 — under the floor, a veto in all but name.
		const old = bullet(1, 10, 0.58, { age: 1 });
		expect(surfaceScore(old, 0.5)).toBeGreaterThan(0.5);
		expect(surfaceScore(old, 0.5)).toBeCloseTo(0.5 + 0.08 * (1 - RECENCY_PENALTY));
	});

	it('makes age decide who loses the page, not who may compete', () => {
		// Two additions of nearly equal relevance, room for one. Age is the whole
		// difference between them, and the page is where it is spent — a full
		// page is what a resume is, so the choice is which item, not how many.
		const decisions = selectForJob(
			[
				bullet(1, 10, 0.9, { chars: 100 }),
				bullet(2, 10, 0.9, { chars: 100 }),
				bullet(3, 10, 0.62, { visible: false, chars: 100, age: 0.95 }),
				bullet(4, 10, 0.6, { visible: false, chars: 100, age: 0 })
			],
			{ ...OPTS, budgetChars: 300 }
		);
		const included = decisions.filter((d) => d.action === 'include').map((d) => d.entityId);
		expect(included).toContain(4);
		expect(included).not.toContain(3);
	});

	it('still keeps old work a job is genuinely about', () => {
		const decisions = selectForJob(
			[
				bullet(1, 10, 0.4),
				bullet(2, 10, 0.5),
				bullet(3, 10, 0.6),
				bullet(5, 11, 0.95, { visible: false, age: 0.9 })
			],
			OPTS
		);
		expect(decisions.filter((d) => d.action === 'include').map((d) => d.entityId)).toContain(5);
	});

	it('does not demote what the document already shows', () => {
		// Age is not a reason to drop: the applicant put this bullet on the
		// document, and only the page budget takes things off it.
		const decisions = selectForJob(
			[bullet(1, 10, 0.9, { age: 1 }), bullet(2, 10, 0.9), bullet(3, 10, 0.9)],
			OPTS
		);
		expect(decisions.some((d) => d.action === 'exclude')).toBe(false);
	});

	it('breaks a tie for the page in favour of the newer', () => {
		// Three bullets of equal relevance, room for two: the old one goes.
		const decisions = selectForJob(
			[
				bullet(1, 10, 0.5, { chars: 100, age: 0 }),
				bullet(2, 10, 0.5, { chars: 100, age: 0.1 }),
				bullet(3, 10, 0.5, { chars: 100, age: 0.95 })
			],
			{ ...OPTS, budgetChars: 200 }
		);
		expect(decisions.filter((d) => d.action === 'exclude').map((d) => d.entityId)).toEqual([3]);
	});
});

describe('what a hold-back costs', () => {
	it('charges a version tag nothing', () => {
		// "This is my Django resume" is an answer for a class of jobs, written
		// before this one existed. Tailoring is the thing that gets to disagree.
		expect(surfaceScore(bullet(1, 10, 0.8, { visible: false }))).toBeCloseTo(0.8);
	});

	it('charges "CV only" a quarter of the margin, and profile-only twice that', () => {
		expect(surfaceScore(bullet(1, 10, 0.8, { templateHeldBack: true }), 0.5)).toBeCloseTo(
			0.5 + 0.3 * (1 - HOLD_BACK_PENALTY.template)
		);
		expect(surfaceScore(bullet(1, 10, 0.8, { profileOnly: true }), 0.5)).toBeCloseTo(
			0.5 + 0.3 * (1 - HOLD_BACK_PENALTY.profile)
		);
	});

	it('takes the stronger statement when an item makes both', () => {
		// Profile-only is stored as the !resume + !cv pair, so it reads as a
		// template hold-back too. It is the more emphatic of the two.
		const both = bullet(1, 10, 0.8, { profileOnly: true, templateHeldBack: true });
		expect(surfaceScore(both, 0.5)).toBeCloseTo(0.5 + 0.3 * (1 - HOLD_BACK_PENALTY.profile));
	});

	it('compounds with age rather than replacing it', () => {
		const c = bullet(1, 10, 0.8, { templateHeldBack: true, age: 1 });
		expect(surfaceScore(c, 0.5)).toBeCloseTo(
			0.5 + 0.3 * (1 - RECENCY_PENALTY) * (1 - HOLD_BACK_PENALTY.template)
		);
	});

	it('never drops an item below the floor, whatever it is tagged', () => {
		const c = bullet(1, 10, 0.9, { profileOnly: true, age: 1 });
		expect(surfaceScore(c, 0.5)).toBeGreaterThanOrEqual(0.5);
	});

	it('leaves a sub-floor item where it is rather than lifting it', () => {
		// Charging a margin it never earned would return the floor itself, which
		// clears a bar sitting on the floor — a penalty that promotes.
		const c = bullet(1, 10, 0.468, { age: 0.42 });
		expect(surfaceScore(c, 0.5)).toBeCloseTo(0.468);
	});

	it('never vetoes: a job that is about the held-back thing still gets it', () => {
		const decisions = selectForJob(
			[
				bullet(1, 10, 0.3),
				bullet(2, 10, 0.4),
				bullet(3, 10, 0.5),
				bullet(9, 10, 0.99, { visible: false, profileOnly: true, templateHeldBack: true })
			],
			OPTS
		);
		expect(decisions).toContainEqual(expect.objectContaining({ entityId: 9, action: 'include' }));
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
		// would take the required skill off the page with it — even though it is
		// the worst-scoring group of the three and the cap is biting.
		const decisions = selectForJob(
			[group(1, 0.9), group(2, 0.9), group(3, 0.01, { pinned: true })],
			OPTS
		);
		expect(decisions.some((d) => d.entityId === 3)).toBe(false);
	});

	it('keeps a floor of groups, so the section cannot vanish', () => {
		const decisions = selectForJob([group(1, 0.01), group(2, 0.01), group(3, 0.01)], OPTS);
		expect(decisions.filter((d) => d.action === 'exclude')).toHaveLength(1);
	});

	it('keeps every group holding something the job asked for', () => {
		// However badly they score. A document that fits by not mentioning what
		// the job wanted has failed at the thing it was for.
		const decisions = selectForJob(
			[
				group(1, 0.9, { pinned: true }),
				group(2, 0.01, { pinned: true }),
				group(3, 0.01, { pinned: true }),
				group(4, 0.01, { pinned: true }),
				group(5, 0.01)
			],
			OPTS
		);
		expect(decisions.filter((d) => d.action === 'exclude').map((d) => d.entityId)).toEqual([5]);
	});

	it('does not spend the page budget on them', () => {
		// Their chars are zero: a group costs a line either way, and counting it
		// would silently re-tune how much prose survives. So a page with no room
		// left drops exactly what the cap drops, and nothing more.
		const groups = [group(1, 0.9), group(2, 0.9), group(3, 0.9)];
		expect(selectForJob(groups, { ...OPTS, budgetChars: 0 })).toEqual(
			selectForJob(groups, { ...OPTS, budgetChars: 10_000 })
		);
	});
});

describe('chooseBudget', () => {
	const chars = (total: number, over: Partial<Candidate> = {}) =>
		bullet(1, 10, 0.5, { chars: total, ...over });

	it('aims at one page when the material nearly fits it', () => {
		expect(chooseBudget([chars(PAGE_BUDGETS.one)])).toBe(PAGE_BUDGETS.one);
		// A quarter over is two or three bullets — a trim, not a rewrite.
		expect(chooseBudget([chars(Math.round(PAGE_BUDGETS.one * 1.2))])).toBe(PAGE_BUDGETS.one);
	});

	it('aims optimistically, because missing is only a few seconds', () => {
		// The fit pass renders the result and falls back to the roomier target
		// when it misses, so half again over is still worth a try.
		expect(chooseBudget([chars(Math.round(PAGE_BUDGETS.one * 1.5))])).toBe(PAGE_BUDGETS.one);
	});

	it('gives up on one page rather than gut a full career', () => {
		// 3,502 chars is this profile. One page would have meant dropping two
		// thirds of it, and its owner's answer was that it is not worth that.
		expect(chooseBudget([chars(3502)])).toBe(PAGE_BUDGETS.two);
		expect(chooseBudget([chars(Math.round(PAGE_BUDGETS.one * 2.1))])).toBe(PAGE_BUDGETS.two);
	});

	it('measures what would print, not what exists', () => {
		// A hidden bullet is not on the page and must not push the target out.
		const hidden = chars(9_000, { visible: false });
		expect(chooseBudget([chars(500), hidden])).toBe(PAGE_BUDGETS.one);
	});

	it('counts a skill toward nothing — it has no chars', () => {
		const skill: Candidate = {
			entityType: OVERRIDE_ENTITIES.skill,
			entityId: 1,
			parentId: null,
			label: 'Python',
			chars: 6,
			visible: true,
			pinned: true,
			score: 1
		};
		expect(chooseBudget([chars(500), skill])).toBe(PAGE_BUDGETS.one);
	});

	it('falls back to the largest target when nothing fits', () => {
		expect(chooseBudget([chars(50_000)])).toBe(PAGE_BUDGETS.two);
	});
});

describe('tightenBudget', () => {
	it('cuts harder than the page ratio', () => {
		// Halving the prose does not halve the pages — the template's fixed height
		// goes nowhere — so scaling by 1/2 undershoots and wastes an attempt.
		expect(tightenBudget(3400, 2, 1)).toBeLessThan(1700);
	});

	it('converges rather than creeping', () => {
		let budget = PAGE_BUDGETS.two;
		const seen = [budget];
		for (let i = 0; i < 3; i++) {
			budget = tightenBudget(budget, 2, 1);
			seen.push(budget);
		}
		// Strictly decreasing, and inside one page's worth within three tries.
		expect(seen.every((b, i) => i === 0 || b < seen[i - 1])).toBe(true);
		expect(budget).toBeLessThan(PAGE_BUDGETS.one);
	});

	it('never returns a budget that would empty the document', () => {
		expect(tightenBudget(1, 9, 1)).toBeGreaterThan(0);
		expect(tightenBudget(1156, 5, 2)).toBeGreaterThan(0);
	});
});
