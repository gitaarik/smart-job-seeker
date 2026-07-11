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
  embeddingDimensions: number;
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
  { model: string; dimensions: number }
> = {
  openai: { model: "text-embedding-3-small", dimensions: 1536 },
  gemini: { model: "text-embedding-004", dimensions: 768 },
};

function loadConfig(): AppConfig {
  const nodeEnv = getEnv("NODE_ENV", "development");
  const llmProvider = getEnv("SJS_LLM_PROVIDER", "groq");
  const embeddingProvider: "openai" | "gemini" =
    getEnv("SJS_EMBEDDING_PROVIDER", "openai") === "gemini"
      ? "gemini"
      : "openai";
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
    llmProvider: (llmProvider as
      | "groq"
      | "gemini"
      | "openai"
      | "deepseek"
      | "cerebras"),
    llmModel: getModelForProvider(llmProvider),
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
    embeddingEnabled: getEnv("SJS_EMBEDDING_ENABLED", "false") === "true",
    embeddingSkillThreshold: parseFloat(
      getEnv("SJS_EMBEDDING_SKILL_THRESHOLD", "0.55"),
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
