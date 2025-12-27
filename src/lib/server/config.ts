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

  // LLM Configuration
  llmCacheTTL: number; // milliseconds

  // Retry Configuration
  retryMaxAttempts: number;
  retryInitialDelay: number;
  retryMaxDelay: number;

  // Scraper Configuration
  scraperDefaultTimeout: number;
  scraperNetworkIdleTimeout: number;
  scraperMaxRetries: number;
  scraperDebugMode: boolean;
  scraperScrollMaxIterations: number;
  scraperSaveDebugScreenshots: boolean;
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
    databaseUrl: getEnv("SJS_DATABASE_URL"),

    // External Services
    directusUrl: getEnv("SJS_ADMIN_URL"),
    directusToken: getEnv("SJS_ADMIN_TOKEN"),
    directusWebhookSecret: getEnv("SJS_WEBHOOK_SECRET"),

    // LLM
    groqApiKey: getEnv("SJS_GROQ_API_KEY"),

    // Caching (1 hour default)
    llmCacheTTL: parseInt(
      getEnv("SJS_LLM_CACHE_TTL", String(1000 * 60 * 60)),
      10,
    ),

    // Retry
    retryMaxAttempts: parseInt(getEnv("SJS_RETRY_MAX_ATTEMPTS", "3"), 10),
    retryInitialDelay: parseInt(getEnv("SJS_RETRY_INITIAL_DELAY", "1000"), 10),
    retryMaxDelay: parseInt(getEnv("SJS_RETRY_MAX_DELAY", "10000"), 10),

    // Scraper
    scraperDefaultTimeout: parseInt(
      getEnv("SCRAPER_DEFAULT_TIMEOUT", "30000"),
      10,
    ),
    scraperNetworkIdleTimeout: parseInt(
      getEnv("SCRAPER_NETWORK_IDLE_TIMEOUT", "45000"),
      10,
    ),
    scraperMaxRetries: parseInt(getEnv("SCRAPER_MAX_RETRIES", "2"), 10),
    scraperDebugMode: getEnv("SCRAPER_DEBUG_MODE", "false") === "true",
    scraperScrollMaxIterations: parseInt(
      getEnv("SCRAPER_SCROLL_MAX_ITERATIONS", "3"),
      10,
    ),
    scraperSaveDebugScreenshots: getEnv(
      "SCRAPER_SAVE_DEBUG_SCREENSHOTS",
      "false",
    ) === "true",
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
