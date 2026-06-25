/**
 * Embedding utilities for semantic skill matching and RAG retrieval.
 *
 * Separate from the chat-completion layer (langchain.ts): the chat default
 * provider (Groq) has no embeddings API, so embeddings get their own
 * provider/model config (see config.embedding*). Reuses the chat API keys.
 *
 * All semantic features must guard on isEmbeddingConfigured() and degrade to
 * the existing exact matching when embeddings are unavailable — embedding is
 * an enhancement, never a hard dependency of matching.
 */

import { OpenAIEmbeddings } from "@langchain/openai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import type { Embeddings } from "@langchain/core/embeddings";
import { config } from "$lib/server/config";

/** API key for the configured embedding provider, or "" if absent. */
function embeddingApiKey(): string {
  return config.embeddingProvider === "gemini"
    ? config.geminiApiKey
    : config.openaiApiKey;
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
    throw new Error(
      `Embedding provider "${config.embeddingProvider}" has no API key configured`,
    );
  }
  cachedModel = config.embeddingProvider === "gemini"
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
