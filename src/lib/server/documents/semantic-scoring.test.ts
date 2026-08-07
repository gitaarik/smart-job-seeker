/**
 * Tests for semanticScoreProjects — the max-pool ranker.
 *
 * Embeddings + DB are mocked: each unit's embedText maps to a fixed vector, the
 * job maps to another, and cosine is real. No cached rows (select → []), so
 * every unit is embedded fresh and the insert chain is a no-op. This isolates
 * the one behaviour that only lived in live verification before: a project's
 * score is the MAX cosine over its units, so its best-matching source wins.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
	// Job points straight down the "frontend" axis (index 0).
	const JOB = [1, 0, 0];
	// Unit embedText → vector. A project's units can point different ways.
	const VECTORS: Record<string, number[]> = {
		'ai typed': [0, 1, 0], // orthogonal to the job → ~0
		'ai attachment': [0, 0.9, 0.1], // still far from the job
		'frontend attachment': [0.95, 0.05, 0], // near the job
		'backend typed': [0, 0, 1] // far
	};
	return {
		JOB,
		VECTORS,
		configured: { value: true },
		embedQuery: vi.fn(() => Promise.resolve(JOB)),
		embedDocs: vi.fn((texts: string[]) =>
			Promise.resolve(texts.map((t) => VECTORS[t] ?? [0, 0, 0]))
		)
	};
});

vi.mock('$lib/server/llm/embeddings', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/llm/embeddings')>(
		'$lib/server/llm/embeddings'
	);
	return {
		isEmbeddingConfigured: () => h.configured.value,
		cosineSimilarity: actual.cosineSimilarity,
		truncateVector: (v: number[]) => v, // 768 working dim > 3-dim mocks → no-op
		embed: h.embedQuery,
		embedBatch: h.embedDocs
	};
});

vi.mock('$lib/server/config', () => ({
	config: { embeddingModel: 'test-model', embeddingWorkingDimensions: 768 }
}));

// DB: no cached vectors (select → []); insert upsert is a no-op.
const mockWhere = vi.fn().mockResolvedValue([]);
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
const mockOnConflict = vi.fn().mockResolvedValue(undefined);
const mockValues = vi.fn().mockReturnValue({
	onConflictDoUpdate: mockOnConflict
});
const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		select: (...a: unknown[]) => mockSelect(...a),
		insert: (...a: unknown[]) => mockInsert(...a)
	}
}));

vi.mock('$lib/server/db/schema', () => ({
	project_embeddings: {
		profile_id: 'profile_id',
		model: 'model',
		project_id: 'project_id',
		project_kind: 'project_kind',
		attachment_id: 'attachment_id'
	}
}));

vi.mock('drizzle-orm', () => ({
	and: (...a: unknown[]) => a,
	eq: (_c: unknown, v: unknown) => v,
	inArray: (_c: unknown, v: unknown) => v,
	sql: new Proxy(() => {}, { get: () => () => {} })
}));

import { semanticScoreProjects } from './project-embeddings';
import type { EmbeddableUnit } from './project-embeddings';

const job = { title: 'Frontend Engineer', skills_required: ['React'] };

beforeEach(() => {
	h.configured.value = true;
	mockWhere.mockResolvedValue([]);
});

describe('semanticScoreProjects (max-pool)', () => {
	it('scores a project by its BEST-matching unit, not an average', async () => {
		// One project with a far-from-job typed unit + a far AI attachment + a
		// near frontend attachment. Max-pool must report the near one's score.
		const units: EmbeddableUnit[] = [
			{
				projectKind: 'work_experience_project',
				projectId: 1,
				attachmentId: 0,
				embedText: 'ai typed'
			},
			{
				projectKind: 'work_experience_project',
				projectId: 1,
				attachmentId: 14,
				embedText: 'ai attachment'
			},
			{
				projectKind: 'work_experience_project',
				projectId: 1,
				attachmentId: 15,
				embedText: 'frontend attachment'
			}
		];
		const scores = await semanticScoreProjects(1, units, job);
		expect(scores).not.toBeNull();
		const s = scores!.get('work_experience_project:1')!;
		// cosine(job, frontend attachment) ≈ 0.998; the AI units are ~0.
		expect(s).toBeGreaterThan(0.99);
	});

	it("keeps each project's score independent (grouped by projectKey)", async () => {
		const units: EmbeddableUnit[] = [
			{
				projectKind: 'side_project',
				projectId: 7,
				attachmentId: 0,
				embedText: 'frontend attachment'
			},
			{
				projectKind: 'side_project',
				projectId: 8,
				attachmentId: 0,
				embedText: 'backend typed'
			}
		];
		const scores = await semanticScoreProjects(1, units, job);
		expect(scores!.get('side_project:7')).toBeGreaterThan(0.99);
		expect(scores!.get('side_project:8')).toBeLessThan(0.1);
	});

	it('returns null (→ lexical fallback) when embeddings are unconfigured', async () => {
		h.configured.value = false;
		const units: EmbeddableUnit[] = [
			{
				projectKind: 'side_project',
				projectId: 7,
				attachmentId: 0,
				embedText: 'frontend attachment'
			}
		];
		expect(await semanticScoreProjects(1, units, job)).toBeNull();
	});

	it('returns null when there are no units', async () => {
		expect(await semanticScoreProjects(1, [], job)).toBeNull();
	});
});
