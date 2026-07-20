/**
 * Centralized Configuration
 * All environment variables and configuration in one place
 * with validation
 */

import { getEnv } from "$lib/tools/get-env";

export interface AppConfig {
  // Environment
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;

  // Database
  databaseUrl: string;

  // External Services
  publicSiteUrl: string;

  // Browser
  chromePath: string;

  // Internal rendering (for server-side PDF generation)
  internalRenderSecret: string;

  // LLM (for TypeScript/SvelteKit app)
  llmProvider:
    | "groq"
    | "gemini"
    | "openai"
    | "deepseek"
    | "cerebras";
  llmModel: string; // Configurable model name, with smart defaults per provider
  // Model + provider used specifically for résumé/CV auto-translation.
  // Translation is a model-leverage task, so it can point at a stronger model
  // (and a different provider) than the app default.
  llmTranslateModel: string;
  llmTranslateProvider: string;
  // Model + provider for user-facing writing (cover letters, application
  // answers, AI chat). Prose quality matters and volume is low, so this can use
  // a stronger model/provider than the extraction pipeline. Falls back to the
  // app provider/model.
  llmWritingModel: string;
  llmWritingProvider: string;
  groqApiKey: string;
  geminiApiKey: string;
  openaiApiKey: string;
  deepseekApiKey: string;
  cerebrasApiKey: string;

  // Embeddings (semantic skill matching / RAG retrieval)
  // Separate from the chat provider: the chat default (groq) has no embeddings
  // API, so embeddings get their own provider/model. Reuses the chat API keys.
  embeddingProvider: "openai" | "gemini";
  embeddingModel: string;
  // Native dimensionality the model returns; what we persist in skill_embeddings.
  embeddingDimensions: number;
  // Working dimensionality: vectors are truncated to this on load for in-memory
  // cosine (Matryoshka — see truncateVector). <= embeddingDimensions. This is
  // what the skill threshold is tuned against, so the two move together.
  embeddingWorkingDimensions: number;
  // Master switch — when off (or no key for the provider), semantic features
  // degrade gracefully to the existing exact matching.
  embeddingEnabled: boolean;
  // Cosine threshold above which two skills count as a semantic match.
  // Needs empirical tuning per embedding model (see SEMANTIC-MATCHING plan).
  embeddingSkillThreshold: number;

  // LLM Configuration
  llmCacheTTL: number; // milliseconds

  // Retry Configuration
  retryMaxAttempts: number;
  retryInitialDelay: number;
  retryMaxDelay: number;

  // Redis
  redisHost: string;
  redisPort: number;

  // Scraping
  browserProvider: string;
  defaultBrowserProvider: string;
  defaultMaxJobs: number | null;
  localBrowserAllowed: boolean;
}

/**
 * Get model for a given provider
 * Priority: Provider-specific env var → Hardcoded default
 */
function getModelForProvider(provider: string): string {
  const hardcodedDefaults: Record<string, string> = {
    groq: "openai/gpt-oss-120b",
    gemini: "gemini-2.0-flash-exp",
    openai: "gpt-4o",
    deepseek: "deepseek-chat",
    cerebras: "llama-3.3-70b",
  };

  // Provider-specific env var names
  const providerEnvVars: Record<string, string> = {
    groq: "SJS_LLM_MODEL_GROQ",
    gemini: "SJS_LLM_MODEL_GEMINI",
    openai: "SJS_LLM_MODEL_OPENAI",
    deepseek: "SJS_LLM_MODEL_DEEPSEEK",
    cerebras: "SJS_LLM_MODEL_CEREBRAS",
  };

  const hardcodedDefault = hardcodedDefaults[provider] ||
    hardcodedDefaults.groq;
  const providerEnvVar = providerEnvVars[provider];

  // Priority: provider-specific → hardcoded default
  return providerEnvVar
    ? getEnv(providerEnvVar, hardcodedDefault)
    : hardcodedDefault;
}

/**
 * Load and validate configuration
 */
// Default embedding model + dimensions per provider.
const EMBEDDING_DEFAULTS: Record<
  string,
  { model: string; dimensions: number; workingDimensions: number }
> = {
  // text-embedding-3-small is already compact; work at native.
  openai: {
    model: "text-embedding-3-small",
    dimensions: 1536,
    workingDimensions: 1536,
  },
  // text-embedding-004 / embedding-001 are decommissioned — they return an API
  // error, which embedDocuments() swallows into empty vectors (see
  // llm/embeddings.ts). gemini-embedding-001 is the current model. We persist
  // the native 3072 (@langchain/google-genai@2 doesn't expose
  // outputDimensionality) but truncate to 768 on load: measured over the live
  // vocabulary, 768 preserves signal (k8s≈Kubernetes ~0.80) at ~1/4 the memory
  // and cosine cost. The 0.68 skill threshold is tuned for 768 — retune if this
  // changes.
  gemini: {
    model: "gemini-embedding-001",
    dimensions: 3072,
    workingDimensions: 768,
  },
};

function loadConfig(): AppConfig {
  const nodeEnv = getEnv("NODE_ENV", "development");
  const llmProvider = getEnv("SJS_LLM_PROVIDER", "groq");
  // Translation and user-facing writing can each run on a different provider
  // than the rest of the app (defaults to the app provider).
  const llmTranslateProvider = getEnv("SJS_LLM_TRANSLATE_PROVIDER", "") ||
    llmProvider;
  const llmWritingProvider = getEnv("SJS_LLM_WRITING_PROVIDER", "") ||
    llmProvider;
  // Default to gemini: it is the provider this project actually pays for
  // (SJS_LLM_WRITING_PROVIDER / SJS_LLM_TRANSLATE_PROVIDER), and Groq — the
  // chat default — has no embeddings API at all. Defaulting to openai meant
  // the default config pointed at a provider with no quota.
  const embeddingProvider: "openai" | "gemini" =
    getEnv("SJS_EMBEDDING_PROVIDER", "gemini") === "openai"
      ? "openai"
      : "gemini";
  const embeddingDefaults = EMBEDDING_DEFAULTS[embeddingProvider];

  const config = {
    // Environment
    nodeEnv,
    isDevelopment: nodeEnv === "development",
    isProduction: nodeEnv === "production",

    // Database
    databaseUrl: getEnv("SJS_DATABASE_URL"),

    // External Services
    publicSiteUrl: getEnv("SJS_APP_URL_HOST", "http://localhost:5173"),

    // Browser
    chromePath: getEnv("SJS_CHROME_PATH", ""),

    // Internal rendering (for server-side PDF generation)
    internalRenderSecret: getEnv(
      "SJS_INTERNAL_RENDER_SECRET",
      "dev-internal-render-secret",
    ),

    // LLM (for TypeScript/SvelteKit app)
    llmProvider: llmProvider as
      | "groq"
      | "gemini"
      | "openai"
      | "deepseek"
      | "cerebras",
    llmModel: getModelForProvider(llmProvider),
    // Translation is a model-leverage task and can point at a stronger model
    // (and provider) than the app default. On Groq, llama-3.3-70b handles
    // CV-style Dutch/German far better than the reasoning gpt-oss default; on
    // Gemini, flash follows keep-English + uniform-past style reliably.
    // Override with SJS_LLM_TRANSLATE_PROVIDER / SJS_LLM_TRANSLATE_MODEL.
    llmTranslateProvider,
    llmTranslateModel: getEnv("SJS_LLM_TRANSLATE_MODEL", "") ||
      (llmTranslateProvider === "groq"
        ? "llama-3.3-70b-versatile"
        : llmTranslateProvider === "gemini"
        ? "gemini-2.5-pro"
        : getModelForProvider(llmTranslateProvider)),
    llmWritingProvider,
    llmWritingModel: getEnv("SJS_LLM_WRITING_MODEL", "") ||
      (llmWritingProvider === "gemini"
        ? "gemini-2.5-pro"
        : getModelForProvider(llmWritingProvider)),
    groqApiKey: getEnv("SJS_LLM_API_KEY_GROQ", ""),
    geminiApiKey: getEnv("SJS_LLM_API_KEY_GEMINI", ""),
    openaiApiKey: getEnv("SJS_LLM_API_KEY_OPENAI", ""),
    deepseekApiKey: getEnv("SJS_LLM_API_KEY_DEEPSEEK", ""),
    cerebrasApiKey: getEnv("SJS_LLM_API_KEY_CEREBRAS", ""),

    // Embeddings
    embeddingProvider,
    embeddingModel: getEnv("SJS_EMBEDDING_MODEL", embeddingDefaults.model),
    embeddingDimensions: parseInt(
      getEnv("SJS_EMBEDDING_DIMENSIONS", String(embeddingDefaults.dimensions)),
      10,
    ),
    embeddingWorkingDimensions: parseInt(
      getEnv(
        "SJS_EMBEDDING_WORKING_DIMENSIONS",
        String(embeddingDefaults.workingDimensions),
      ),
      10,
    ),
    embeddingEnabled: getEnv("SJS_EMBEDDING_ENABLED", "false") === "true",
    // Tuned 2026-07-20 against gemini-embedding-001 truncated to 768 working
    // dims over the live job-skill vocabulary (9,385 skills). The original 0.55
    // was never measured and sat INSIDE the noise floor: unrelated skills have a
    // median cosine of ~0.51-0.54 (p99 ~0.63), so "Python" matched
    // "communication" and "k8s" matched "CRM knowledge". At 0.55 a profile
    // listing "React" expanded to ~half the vocabulary, making every profile
    // match every job. At 0.68 (768 dims) expansion is ~10-30 terms per skill
    // and stays above the noise ceiling. Guarded by skill-threshold.test.ts
    // against real data — re-tune (and regenerate that fixture) if the model OR
    // the working dimension changes.
    embeddingSkillThreshold: parseFloat(
      getEnv("SJS_EMBEDDING_SKILL_THRESHOLD", "0.68"),
    ),

    // Caching (1 hour default)
    llmCacheTTL: parseInt(
      getEnv("SJS_LLM_CACHE_TTL", String(1000 * 60 * 60)),
      10,
    ),

    // LLM Retry
    retryMaxAttempts: parseInt(getEnv("SJS_LLM_RETRY_MAX_ATTEMPTS", "3"), 10),
    retryInitialDelay: parseInt(
      getEnv("SJS_LLM_RETRY_INITIAL_DELAY", "1000"),
      10,
    ),
    retryMaxDelay: parseInt(getEnv("SJS_LLM_RETRY_MAX_DELAY", "10000"), 10),

    // Redis
    redisHost: getEnv("REDIS_HOST", "localhost"),
    redisPort: parseInt(getEnv("REDIS_PORT", "6379"), 10),

    // Scraping
    browserProvider: getEnv("SJS_BROWSER_PROVIDER", "local"),
    defaultBrowserProvider: getEnv("SJS_DEFAULT_BROWSER_PROVIDER", "local"),
    defaultMaxJobs: (() => {
      const v = getEnv("SJS_DEFAULT_MAX_JOBS", "25");
      const n = parseInt(v, 10);
      return isNaN(n) || n < 1 ? null : n;
    })(),
    localBrowserAllowed: getEnv("SJS_LOCAL_BROWSER_ALLOWED", "true") === "true",
  };

  return config;
}

// Export singleton config
export const config = loadConfig();

/**
 * Validate required configuration and value constraints
 * Checks both required fields and validates numeric values are sensible
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // Check required fields
  const required: (keyof AppConfig)[] = [
    "databaseUrl",
  ];

  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    errors.push(`Missing required configuration: ${missing.join(", ")}`);
  }

  // Throw if any validation errors
  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n  - ${errors.join("\n  - ")}`,
    );
  }
}

// Note: Don't validate on module load as it runs during build time
// Call validateConfig() manually in production entry points if needed
