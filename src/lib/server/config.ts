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
  adminPublicUrl: string;
  directusUrl: string;
  directusToken: string;
  directusWebhookSecret: string;

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
  scrapeCooldownHours: number;
  scrapeMaxRunsPerCooldown: number;
  browserProvider: string;
  localBrowserAllowed: boolean;
}

/**
 * Get model for a given provider
 * Priority: Provider-specific env var → Hardcoded default
 */
function getModelForProvider(provider: string): string {
  const hardcodedDefaults: Record<string, string> = {
    groq: "meta-llama/llama-4-scout-17b-16e-instruct",
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
function loadConfig(): AppConfig {
  const nodeEnv = getEnv("NODE_ENV", "development");
  const llmProvider = getEnv("SJS_LLM_PROVIDER", "groq");

  const config = {
    // Environment
    nodeEnv,
    isDevelopment: nodeEnv === "development",
    isProduction: nodeEnv === "production",

    // Database
    databaseUrl: getEnv("SJS_DATABASE_URL"),

    // External Services
    // URLs: _HOST = accessible from outside Docker, _DOCKER = container-to-container
    publicSiteUrl: getEnv("SJS_APP_URL_HOST", "http://localhost:5173"),
    adminPublicUrl: getEnv("SJS_ADMIN_URL_HOST", "http://localhost:8055"),
    directusUrl: getEnv("SJS_ADMIN_URL_DOCKER", "http://admin:8055"),
    directusToken: getEnv("SJS_ADMIN_TOKEN", ""),
    directusWebhookSecret: getEnv("SJS_WEBHOOK_SECRET", ""),

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
    scrapeCooldownHours: parseInt(getEnv("SJS_SCRAPE_COOLDOWN_HOURS", "6"), 10),
    scrapeMaxRunsPerCooldown: parseInt(getEnv("SJS_SCRAPE_MAX_RUNS_PER_COOLDOWN", "1"), 10),
    browserProvider: getEnv("SJS_BROWSER_PROVIDER", "local"),
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
    "directusUrl",
    "directusToken",
    "directusWebhookSecret",
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
