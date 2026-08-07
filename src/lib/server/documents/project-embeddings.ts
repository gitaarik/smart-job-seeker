/**
 * Semantic project↔job retrieval — the "R" in the cover-letter / answer / match
 * RAG. Turns the deterministic keyword-overlap ranker in retrieval.ts into
 * genuine embedding retrieval: embed the applicant's projects and the target
 * job, rank by cosine. Catches paraphrase/synonym fit lexical overlap misses.
 *
 * GRANULARITY: one vector per *embeddable unit*, not per project. A project's
 * own typed data is one unit; each attached source (upload/archive/git repo) is
 * another. Retrieval MAX-POOLS a project's units, so a project with three repos
 * is scored by its single best-matching source rather than a blurred average —
 * adding a source can only help a project surface, never wash it out.
 *
 * The corpus is the applicant's OWN projects — bounded per profile — so vectors
 * are jsonb + JS cosine, exactly like skill-embeddings.ts. No pgvector.
 *
 * Cache is lazy + hash-gated rather than embed-on-write: units are composed from
 * several tables and change on typed edits, re-summarized docs, or new commits,
 * so hooking every write path would be fragile. Each unit's text is hashed; a
 * stored vector is reused only while the hash matches, and the first retrieval
 * after any change re-embeds. See project_embeddings in schema.ts.
 *
 * Degrades to a no-op (returns null) when embeddings are unconfigured or the
 * provider fails — the caller falls back to the deterministic ranker.
 */

import { createHash } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { project_embeddings } from '$lib/server/db/schema';
import { config } from '$lib/server/config';
import {
	cosineSimilarity,
	embed,
	embedBatch,
	isEmbeddingConfigured,
	truncateVector
} from '$lib/server/llm/embeddings';
import type { JobLike } from './retrieval';

export type ProjectKind = 'side_project' | 'work_experience_project';

/**
 * One embeddable unit. `attachmentId` 0 is the project's own typed data;
 * a positive value is a profile_document_projects row (an uploaded doc/repo).
 */
export interface EmbeddableUnit {
	projectKind: ProjectKind;
	projectId: number;
	attachmentId: number;
	embedText: string;
}

/** Stable key for the project a unit rolls up to (the max-pool bucket). */
export function projectKey(kind: string, id: number): string {
	return `${kind}:${id}`;
}

/** Stable key for a single unit (project + attachment). */
function unitKey(u: { projectKind: string; projectId: number; attachmentId: number }): string {
	return `${u.projectKind}:${u.projectId}:${u.attachmentId}`;
}

/**
 * Content hash gating re-embedding. Model-scoped so swapping the embedding model
 * invalidates every unit's vector (vectors across models are incomparable).
 */
function contentHash(model: string, text: string): string {
	return createHash('sha256').update(`${model}\n${text}`).digest('hex');
}

/** The job side of the query: what a relevant project should be near. */
export function buildJobQueryText(job: JobLike): string {
	return [job.title, job.job_description, (job.skills_required ?? []).join(', ')]
		.filter((s): s is string => !!s && s.trim().length > 0)
		.join('\n')
		.trim();
}

/**
 * Native-dim embedding vector per unit (keyed by unitKey), embedding +
 * persisting any whose stored vector is missing or stale (content changed, or a
 * different model).
 *
 * Throws on an empty-vector provider failure: like skill-embeddings.ts, an empty
 * vector must never be persisted (it would poison the cache and silently score
 * the unit at 0 forever) — surface it so the caller falls back to lexical.
 */
async function getUnitVectors(
	profileId: number,
	units: EmbeddableUnit[]
): Promise<Map<string, number[]>> {
	const model = config.embeddingModel;
	const wantHash = new Map<string, string>();
	for (const u of units) {
		wantHash.set(unitKey(u), contentHash(model, u.embedText));
	}

	// Bounded per-profile corpus — load all this profile's units for the model.
	const projectIds = [...new Set(units.map((u) => u.projectId))];
	const rows = projectIds.length
		? await db
				.select()
				.from(project_embeddings)
				.where(
					and(
						eq(project_embeddings.profile_id, profileId),
						eq(project_embeddings.model, model),
						inArray(project_embeddings.project_id, projectIds)
					)
				)
		: [];

	const result = new Map<string, number[]>();
	for (const r of rows) {
		const key = unitKey({
			projectKind: r.project_kind,
			projectId: r.project_id,
			attachmentId: r.attachment_id
		});
		if (wantHash.get(key) === r.content_hash) {
			result.set(key, r.embedding as number[]);
		}
	}

	const stale = units.filter((u) => !result.has(unitKey(u)));
	if (stale.length === 0) return result;

	const vectors = await embedBatch(stale.map((u) => u.embedText));
	const now = new Date();
	const toPersist: (typeof project_embeddings.$inferInsert)[] = [];
	const invalid: string[] = [];
	for (let i = 0; i < stale.length; i++) {
		const u = stale[i];
		const vec = vectors[i];
		const key = unitKey(u);
		if (vec?.length > 0) {
			result.set(key, vec);
			toPersist.push({
				profile_id: profileId,
				source_type: u.attachmentId === 0 ? 'project_typed' : 'attachment',
				project_kind: u.projectKind,
				project_id: u.projectId,
				attachment_id: u.attachmentId,
				content_hash: wantHash.get(key)!,
				embedding: vec, // persist NATIVE dim; truncate on read
				model,
				date_created: now,
				date_updated: now
			});
		} else {
			invalid.push(key);
		}
	}

	if (toPersist.length > 0) {
		await db
			.insert(project_embeddings)
			.values(toPersist)
			.onConflictDoUpdate({
				target: [
					project_embeddings.project_kind,
					project_embeddings.project_id,
					project_embeddings.attachment_id
				],
				set: {
					profile_id: sql`excluded.profile_id`,
					source_type: sql`excluded.source_type`,
					content_hash: sql`excluded.content_hash`,
					embedding: sql`excluded.embedding`,
					model: sql`excluded.model`,
					date_updated: sql`excluded.date_updated`
				}
			});
	}

	if (invalid.length > 0) {
		throw new Error(
			`Embedding provider returned ${invalid.length}/${stale.length} empty ` +
				`project vectors (model=${model}). Not persisted.`
		);
	}

	return result;
}

/**
 * Score each project against the job, keyed by projectKey — a project's score is
 * the MAX cosine over its units (best-matching source wins). Returns null —
 * signalling the caller to fall back to the deterministic ranker — when
 * embeddings are unconfigured, there's nothing to rank, or the provider fails.
 * Never throws.
 */
export async function semanticScoreProjects(
	profileId: number,
	units: EmbeddableUnit[],
	job: JobLike
): Promise<Map<string, number> | null> {
	if (!isEmbeddingConfigured() || units.length === 0) return null;
	const query = buildJobQueryText(job);
	if (!query) return null;

	try {
		const [unitVectors, jobNative] = await Promise.all([
			getUnitVectors(profileId, units),
			embed(query)
		]);
		if (!jobNative?.length) return null;

		const dims = config.embeddingWorkingDimensions;
		const jobVec = truncateVector(jobNative, dims);
		const scores = new Map<string, number>();
		for (const u of units) {
			const native = unitVectors.get(unitKey(u));
			if (!native?.length) continue;
			const s = cosineSimilarity(jobVec, truncateVector(native, dims));
			const pk = projectKey(u.projectKind, u.projectId);
			const prev = scores.get(pk);
			if (prev === undefined || s > prev) scores.set(pk, s);
		}
		return scores;
	} catch (err) {
		console.warn('[project-embeddings] semantic scoring failed, falling back to lexical:', err);
		return null;
	}
}
