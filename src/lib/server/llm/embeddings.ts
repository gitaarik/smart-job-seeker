/**
 * Embedding utilities for semantic skill matching and RAG retrieval.
 *
 * Separate from the chat-completion layer (langchain.ts): the app provider
 * (Groq) has no embeddings API, so embeddings get their own provider/model
 * config (see config.embedding*). Reuses the same API keys.
 *
 * "Chat" above means the chat-COMPLETION API, not the assistant chat. That is a
 * writing prompt (WRITING_PROMPT_KEYS in ai-chat/utils.ts) and runs on
 * config.llmWritingProvider — gemini.
 *
 * All semantic features must guard on isEmbeddingConfigured() and degrade to
 * the existing exact matching when embeddings are unavailable — embedding is
 * an enhancement, never a hard dependency of matching.
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import type { Embeddings } from '@langchain/core/embeddings';
import { config } from '$lib/server/config';

/** API key for the configured embedding provider, or "" if absent. */
function embeddingApiKey(): string {
	return config.embeddingProvider === 'gemini' ? config.geminiApiKey : config.openaiApiKey;
}

/**
 * Whether embeddings can be used: master switch on AND a provider key present.
 * Callers fall back to exact matching when this is false.
 */
export function isEmbeddingConfigured(): boolean {
	return config.embeddingEnabled && !!embeddingApiKey();
}

let cachedModel: Embeddings | null = null;

function getEmbeddingModel(): Embeddings {
	if (cachedModel) return cachedModel;
	const apiKey = embeddingApiKey();
	if (!apiKey) {
		throw new Error(`Embedding provider "${config.embeddingProvider}" has no API key configured`);
	}
	cachedModel =
		config.embeddingProvider === 'gemini'
			? new GoogleGenerativeAIEmbeddings({ apiKey, model: config.embeddingModel })
			: new OpenAIEmbeddings({ apiKey, model: config.embeddingModel });
	return cachedModel;
}

/** Embed a single string into a vector. */
export async function embed(text: string): Promise<number[]> {
	return getEmbeddingModel().embedQuery(text);
}

/**
 * Embed many strings in one call. Returns vectors in input order.
 * Empty input short-circuits without hitting the provider.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
	if (texts.length === 0) return [];
	return getEmbeddingModel().embedDocuments(texts);
}

/**
 * Truncate an embedding to its first `dims` components and re-normalize (L2).
 *
 * Only valid for Matryoshka-trained models (e.g. gemini-embedding-001), where
 * the leading components are themselves a coherent lower-dimensional embedding.
 * Measured over the live skill vocabulary, 768-dim truncation preserves signal
 * (k8s≈Kubernetes stays ~0.80) while cutting memory and cosine cost ~4x vs the
 * native 3072. We store native vectors and truncate on load, so the working
 * dimension is a config knob with no re-embedding.
 *
 * Returns the input unchanged when `dims` >= its length.
 */
export function truncateVector(vec: number[], dims: number): number[] {
	if (dims >= vec.length) return vec;
	const head = vec.slice(0, dims);
	let mag = 0;
	for (const x of head) mag += x * x;
	mag = Math.sqrt(mag);
	if (mag === 0) return head;
	return head.map((x) => x / mag);
}

/**
 * Cosine similarity of two equal-length vectors, in [-1, 1].
 * Returns 0 for mismatched lengths or zero-magnitude vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length || a.length === 0) return 0;
	let dot = 0;
	let magA = 0;
	let magB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		magA += a[i] * a[i];
		magB += b[i] * b[i];
	}
	if (magA === 0 || magB === 0) return 0;
	return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
