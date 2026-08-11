import { describe, expect, it } from 'vitest';
import { DEFAULT_SELECTION, selectForJob, type Candidate } from './tailoring';
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

	it('drops bullets below the relevance floor', () => {
		const candidates = [
			bullet(1, 10, 0.9),
			bullet(2, 10, 0.8),
			bullet(3, 10, 0.7),
			bullet(4, 10, 0.05)
		];
		const decisions = selectForJob(candidates, OPTS);
		expect(decisions).toEqual([
			{
				entityType: OVERRIDE_ENTITIES.achievement,
				entityId: 4,
				action: 'exclude',
				sort: null,
				reason: 'not relevant to this job (0.05)'
			}
		]);
	});

	it('never empties a role below the minimum', () => {
		// Every bullet is irrelevant, but a role stripped to nothing reads as
		// padding — the floor on siblings wins over the floor on relevance.
		const candidates = [bullet(1, 10, 0.01), bullet(2, 10, 0.01), bullet(3, 10, 0.01)];
		const decisions = selectForJob(candidates, OPTS);
		expect(decisions.filter((d) => d.action === 'exclude')).toHaveLength(1);
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
		const decisions = selectForJob([project(1, 0.02), project(2, 0.01)], OPTS);
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
		expect(excluded[0].reason).toBe('trimmed to keep the document to length');
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
