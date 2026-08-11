import { describe, expect, it, vi } from 'vitest';

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

import { applyModelOpinions, refFor, shortlistFor } from '../tailor-version';
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
		const { reasons } = applyModelOpinions(
			[bullet(1, 0.9)],
			[{ ref: 'bullet:1', action: 'drop', reason: 'Frontend work, not data engineering.' }],
			FLOOR
		);
		expect(reasons.get('bullet:1')).toBe('Frontend work, not data engineering.');
	});

	it('ignores refs that are not on the shortlist', () => {
		// An invented ref must not become a decision about something else.
		const candidates = [bullet(1, 0.9)];
		const { candidates: adjusted, reasons } = applyModelOpinions(
			candidates,
			[{ ref: 'bullet:999', action: 'drop', reason: 'Made up.' }],
			FLOOR
		);
		expect(adjusted[0].score).toBe(0.9);
		expect(reasons.size).toBe(0);
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
});
