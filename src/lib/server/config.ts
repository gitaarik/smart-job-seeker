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
  directusUrl: string;
  directusToken: string;
  directusWebhookSecret: string;

  // LLM
  groqApiKey: string;
  openaiApiKey: string;

  // Rate Limiting
  rateLimitMaxTokens: number;
  rateLimitRefillRate: number;

  // Caching
  llmCacheTTL: number; // milliseconds

  // Retry
  retryMaxAttempts: number;
  retryInitialDelay: number;
  retryMaxDelay: number;

  // Monitoring
  sentryDsn?: string;
  enableDebugLogging: boolean;
}

/**
 * Load and validate configuration
 */
function loadConfig(): AppConfig {
  const nodeEnv = getEnv("NODE_ENV", "development");

  return {
    // Environment
    nodeEnv,
    isDevelopment: nodeEnv === "development",
    isProduction: nodeEnv === "production",

    // Database
    databaseUrl: getEnv("DATABASE_URL"),

    // External Services
    directusUrl: getEnv("DIRECTUS_URL"),
    directusToken: getEnv("DIRECTUS_TOKEN"),
    directusWebhookSecret: getEnv("DIRECTUS_WEBHOOK_SECRET"),

    // LLM
    groqApiKey: getEnv("GROQ_API_KEY"),
    openaiApiKey: getEnv("OPENAI_API_KEY"),

    // Rate Limiting (with defaults)
    rateLimitMaxTokens: parseInt(
      getEnv("RATE_LIMIT_MAX_TOKENS", "20"),
      10,
    ),
    rateLimitRefillRate: parseFloat(
      getEnv("RATE_LIMIT_REFILL_RATE", "0.5"),
    ),

    // Caching
    llmCacheTTL: parseInt(
      getEnv("LLM_CACHE_TTL", String(1000 * 60 * 60)), // 1 hour default
      10,
    ),

    // Retry
    retryMaxAttempts: parseInt(getEnv("RETRY_MAX_ATTEMPTS", "3"), 10),
    retryInitialDelay: parseInt(getEnv("RETRY_INITIAL_DELAY", "1000"), 10),
    retryMaxDelay: parseInt(getEnv("RETRY_MAX_DELAY", "10000"), 10),

    // Monitoring
    sentryDsn: process.env.SENTRY_DSN,
    enableDebugLogging: getEnv("ENABLE_DEBUG_LOGGING", "false") === "true",
  };
}

// Export singleton config
export const config = loadConfig();

/**
 * Validate required configuration
 */
export function validateConfig(): void {
  const required: (keyof AppConfig)[] = [
    "databaseUrl",
    "directusUrl",
    "directusToken",
    "directusWebhookSecret",
    "groqApiKey",
  ];

  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required configuration: ${missing.join(", ")}`,
    );
  }
}

// Note: Don't validate on module load as it runs during build time
// Call validateConfig() manually in production entry points if needed
