/**
 * Semantic skill matching via cached skill-vocabulary embeddings.
 *
 * Strategy (see planning/SEMANTIC-MATCHING-AND-RAG.md): rather than make the
 * eligibility gates semantic (the SQL gate can't do cosine without pgvector),
 * we *expand* a profile's skill list with semantically-near vocabulary terms
 * before matching. The existing exact-match gates (SQL buildEligibilityFilter
 * and in-memory checkEligibility) then transparently benefit — a profile with
 * "React" gets "frontend" added, so a job requiring "frontend" now matches.
 *
 * The skill vocabulary is bounded, so all vectors are held in memory and
 * compared with cosine in JS — no pgvector dependency. Vectors are persisted
 * in `skill_embeddings` so we embed each distinct skill only once.
 *
 * Everything degrades to a no-op when embeddings are unconfigured: callers get
 * their input back unchanged and matching falls back to exact comparison.
 */

import { eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { skill_embeddings } from '$lib/server/db/schema';
import { config } from '$lib/server/config';
import {
	cosineSimilarity,
	embedBatch,
	isEmbeddingConfigured,
	truncateVector
} from '$lib/server/llm/embeddings';

/**
 * Normalize a skill for use as the vocabulary key.
 *
 * Kept in sync with normalizeSkill() in cloud/src/server/job/match-utils.ts —
 * the expanded skills are matched downstream by that exact-match logic, so the
 * normalization must agree.
 */
function normalizeSkill(skill: string): string {
	return skill
		.toLowerCase()
		.replace(/[^a-z0-9+#]/g, '')
		.trim();
}

interface VocabEntry {
	label: string;
	vector: number[];
}

// In-memory vocabulary for the current embedding model. Loaded lazily on first
// use and grown in place as new skills are embedded. A worker process holds one
// copy; vocab added by other processes is picked up on the next cold start.
let vocab: Map<string, VocabEntry> | null = null;

// Memoized expansion results keyed by the normalized skill set. A matching run
// calls expandProfileSkills once per job for the same profile, so without this
// the full vocab cosine scan would repeat for every job. Short TTL so a mid-run
// profile edit is picked up reasonably soon.
//
// Bounded and LRU-evicted. The TTL alone does not bound this: it is only checked
// when a key is read again, so every skill set ever seen — including each
// intermediate state of a profile being edited — otherwise leaves a permanent
// entry holding its expanded list. Invisible at 19 profiles, a steady leak in a
// worker that runs for weeks.
//
// LRU rather than plain insertion-order eviction because the access pattern is
// skewed: one matching run reuses a single profile's entry across thousands of
// jobs, and a burst of other profiles must not evict the one in active use.
const EXPANSION_TTL_MS = 5 * 60 * 1000;
/** Exported so the eviction test tracks the real cap rather than a copy of it. */
export const EXPANSION_CACHE_MAX = 500;
const expansionCache = new Map<string, { ts: number; result: string[] }>();

function expansionKey(skills: string[]): string {
	return skills
		.map((s) => s.trim().toLowerCase())
		.sort()
		.join('|');
}

/** Cached expansion for `key`, or null if absent or past its TTL. */
function readExpansion(key: string): string[] | null {
	const hit = expansionCache.get(key);
	if (!hit) return null;
	if (Date.now() - hit.ts >= EXPANSION_TTL_MS) {
		expansionCache.delete(key);
		return null;
	}
	// Re-insert to mark most-recently-used; Map iterates in insertion order. The
	// original `ts` rides along, so recency does not extend the TTL.
	expansionCache.delete(key);
	expansionCache.set(key, hit);
	return hit.result;
}

/** Store an expansion, evicting the least-recently-used entries past the cap. */
function writeExpansion(key: string, result: string[]): void {
	expansionCache.delete(key);
	expansionCache.set(key, { ts: Date.now(), result });
	while (expansionCache.size > EXPANSION_CACHE_MAX) {
		const lru = expansionCache.keys().next().value;
		if (lru === undefined) break;
		expansionCache.delete(lru);
	}
}

async function ensureVocabLoaded(): Promise<Map<string, VocabEntry>> {
	if (vocab) return vocab;
	const rows = await db
		.select()
		.from(skill_embeddings)
		.where(eq(skill_embeddings.model, config.embeddingModel));
	// Vectors are stored at native dim; truncate to the working dim once, here,
	// so the cache and every downstream cosine run at the smaller size.
	const dims = config.embeddingWorkingDimensions;
	vocab = new Map(
		rows.map((r) => [
			r.skill,
			{
				label: r.label,
				vector: truncateVector(r.embedding as number[], dims)
			}
		])
	);
	return vocab;
}

/**
 * Embed + persist any of the given skills not already in the vocabulary, and
 * return a Map of normalized-key -> vector for all requested skills.
 * Uses the first-seen original spelling as the stored `label`.
 */
async function getOrCreateVectors(skills: string[]): Promise<Map<string, number[]>> {
	const cache = await ensureVocabLoaded();
	const result = new Map<string, number[]>();

	// Dedupe by normalized key, remembering a representative label.
	const missing = new Map<string, string>(); // key -> label
	for (const raw of skills) {
		const key = normalizeSkill(raw);
		if (!key) continue;
		const hit = cache.get(key);
		if (hit) {
			result.set(key, hit.vector);
		} else if (!missing.has(key)) {
			missing.set(key, raw.trim());
		}
	}

	if (missing.size === 0) return result;

	const keys = [...missing.keys()];
	const labels = keys.map((k) => missing.get(k)!);
	const vectors = await embedBatch(labels);

	// A provider failure (rate limit, decommissioned model, bad key) does NOT
	// always throw: embedDocuments() can resolve with empty vectors where
	// embedQuery() would reject. Persisting those is unrecoverable — the
	// onConflictDoNothing below means a poisoned row is never re-embedded, and
	// cosineSimilarity() returns 0 for a zero-length vector, so the skill
	// silently stops matching forever. Only persist vectors we can verify.
	const valid: number[] = [];
	const invalid: string[] = [];
	for (let i = 0; i < keys.length; i++) {
		if (vectors[i]?.length > 0) valid.push(i);
		else invalid.push(labels[i]);
	}

	if (valid.length > 0) {
		const now = new Date();
		const rows = valid.map((i) => ({
			skill: keys[i],
			label: labels[i],
			embedding: vectors[i],
			model: config.embeddingModel,
			created_at: now
		}));
		// Persist the NATIVE vectors; ignore conflicts (another process may have
		// inserted the same key).
		await db.insert(skill_embeddings).values(rows).onConflictDoNothing();

		// Cache + return at the WORKING dim so freshly-embedded skills compare on
		// the same footing as vocab loaded via ensureVocabLoaded().
		const dims = config.embeddingWorkingDimensions;
		for (const i of valid) {
			const working = truncateVector(vectors[i], dims);
			cache.set(keys[i], { label: labels[i], vector: working });
			result.set(keys[i], working);
		}
	}

	if (invalid.length > 0) {
		// Surface loudly. Callers on the matching path catch this and fall back to
		// exact skills; the backfill path must not report success on a bad batch.
		throw new Error(
			`Embedding provider returned ${invalid.length}/${keys.length} empty vectors ` +
				`(model=${config.embeddingModel}). Not persisted. ` +
				`First few: ${invalid.slice(0, 3).join(', ')}`
		);
	}

	return result;
}

/**
 * Expand a profile's skills with semantically-near vocabulary terms.
 *
 * Returns the original skills plus any vocabulary skill whose embedding is
 * within config.embeddingSkillThreshold cosine of a profile skill. The
 * vocabulary grows as jobs/profiles are processed, so coverage improves over
 * time. No-op (returns input) when embeddings are unconfigured.
 *
 * Never throws — any failure logs and returns the original skills so matching
 * proceeds on exact comparison.
 */
export async function expandProfileSkills(profileSkills: string[]): Promise<string[]> {
	if (!isEmbeddingConfigured() || profileSkills.length === 0) {
		return profileSkills;
	}

	const key = expansionKey(profileSkills);
	const cached = readExpansion(key);
	if (cached !== null) return cached;

	try {
		const cache = await ensureVocabLoaded();
		const profileVectors = await getOrCreateVectors(profileSkills);
		const threshold = config.embeddingSkillThreshold;

		const expanded = new Set(profileSkills);
		for (const pvec of profileVectors.values()) {
			for (const entry of cache.values()) {
				if (cosineSimilarity(pvec, entry.vector) >= threshold) {
					expanded.add(entry.label);
				}
			}
		}
		const result = [...expanded];
		writeExpansion(key, result);
		return result;
	} catch (err) {
		console.warn('[skill-embeddings] expansion failed, falling back to exact skills:', err);
		return profileSkills;
	}
}

/**
 * Embed + persist a batch of skills into the vocabulary without expanding.
 * Used to backfill the job-skill vocabulary (e.g. from existing jobs or on
 * scrape) so profile expansion has job terms to match against.
 * No-op when embeddings are unconfigured. Returns the number newly embedded.
 */
export async function backfillSkillVocabulary(skills: string[]): Promise<number> {
	if (!isEmbeddingConfigured() || skills.length === 0) return 0;
	const cache = await ensureVocabLoaded();
	const before = cache.size;
	await getOrCreateVectors(skills);
	return cache.size - before;
}

/** Test/maintenance hook: drop the in-memory vocabulary + expansion caches. */
export function _resetVocabCache(): void {
	vocab = null;
	expansionCache.clear();
}
