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

  // LLM (for TypeScript/SvelteKit app)
  llmProvider: "groq" | "gemini" | "openai" | "openrouter";
  llmModel: string; // Configurable model name, with smart defaults per provider
  groqApiKey: string;
  geminiApiKey: string;
  openaiApiKey: string;
  openrouterApiKey: string;

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

  // Pagination & Filtering
  scraperMaxJobsPerSearch: number; // Hard limit on jobs per search
  scraperMaxJobAge: number; // Max days old for jobs
  scraperConsecutiveClosedLimit: number; // Stop after N consecutive closed jobs
  scraperPaginationMaxPages: number; // Safety limit for pagination
  scraperInfiniteScrollMaxScrolls: number; // Safety limit for scrolling

  // Timing & Rate Limiting
  scraperPageLoadTimeout: number; // Wait time after page navigation (ms)
  scraperClickWaitTimeout: number; // Wait time after clicking elements (ms)
  scraperRateLimitDelay: number; // Delay between requests to avoid rate limiting (ms)
  scraperCaptchaCheckInterval: number; // Interval for checking CAPTCHA status (ms)
  scraperModalWaitTimeout: number; // Wait time for modal content to load (ms)

  // Browser-Use Integration
  browserUseUrl: string;
  browserUseTimeout: number;
  browserUseFallbackEnabled: boolean;

  // Scraper Method Selection
  scraperMethod: "browser-use" | "playwright";
}

/**
 * Get default model for a given provider
 */
function getDefaultModel(provider: string): string {
  const defaults: Record<string, string> = {
    groq: "meta-llama/llama-4-scout-17b-16e-instruct",
    gemini: "gemini-2.0-flash-exp",
    openai: "gpt-4o",
    openrouter: "anthropic/claude-3.5-sonnet",
  };
  return defaults[provider] || defaults.groq;
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
    directusUrl: getEnv("SJS_ADMIN_URL"),
    directusToken: getEnv("SJS_ADMIN_TOKEN"),
    directusWebhookSecret: getEnv("SJS_WEBHOOK_SECRET"),

    // LLM (for TypeScript/SvelteKit app)
    llmProvider: (llmProvider as "groq" | "gemini" | "openai" | "openrouter"),
    llmModel: getEnv("SJS_LLM_MODEL", getDefaultModel(llmProvider)),
    groqApiKey: getEnv("SJS_GROQ_API_KEY", ""),
    geminiApiKey: getEnv("SJS_GEMINI_API_KEY", ""),
    openaiApiKey: getEnv("SJS_OPENAI_API_KEY", ""),
    openrouterApiKey: getEnv("SJS_OPENROUTER_API_KEY", ""),

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
      getEnv("SJS_SCRAPER_DEFAULT_TIMEOUT", "30000"),
      10,
    ),
    scraperNetworkIdleTimeout: parseInt(
      getEnv("SJS_SCRAPER_NETWORK_IDLE_TIMEOUT", "45000"),
      10,
    ),
    scraperMaxRetries: parseInt(getEnv("SJS_SCRAPER_MAX_RETRIES", "2"), 10),
    scraperDebugMode: getEnv("SJS_SCRAPER_DEBUG_MODE", "false") === "true",
    scraperScrollMaxIterations: parseInt(
      getEnv("SJS_SCRAPER_SCROLL_MAX_ITERATIONS", "3"),
      10,
    ),
    scraperSaveDebugScreenshots: getEnv(
      "SJS_SCRAPER_SAVE_DEBUG_SCREENSHOTS",
      "false",
    ) === "true",

    // Pagination & Filtering
    scraperMaxJobsPerSearch: parseInt(
      getEnv("SJS_SCRAPER_MAX_JOBS_PER_SEARCH", "100"),
      10,
    ),
    scraperMaxJobAge: parseInt(getEnv("SJS_SCRAPER_MAX_JOB_AGE", "60"), 10),
    scraperConsecutiveClosedLimit: parseInt(
      getEnv("SJS_SCRAPER_CONSECUTIVE_CLOSED_LIMIT", "5"),
      10,
    ),
    scraperPaginationMaxPages: parseInt(
      getEnv("SJS_SCRAPER_PAGINATION_MAX_PAGES", "10"),
      10,
    ),
    scraperInfiniteScrollMaxScrolls: parseInt(
      getEnv("SJS_SCRAPER_INFINITE_SCROLL_MAX_SCROLLS", "5"),
      10,
    ),

    // Timing & Rate Limiting
    scraperPageLoadTimeout: parseInt(
      getEnv("SJS_SCRAPER_PAGE_LOAD_TIMEOUT", "3000"),
      10,
    ),
    scraperClickWaitTimeout: parseInt(
      getEnv("SJS_SCRAPER_CLICK_WAIT_TIMEOUT", "1000"),
      10,
    ),
    scraperRateLimitDelay: parseInt(
      getEnv("SJS_SCRAPER_RATE_LIMIT_DELAY", "2000"),
      10,
    ),
    scraperCaptchaCheckInterval: parseInt(
      getEnv("SJS_SCRAPER_CAPTCHA_CHECK_INTERVAL", "3000"),
      10,
    ),
    scraperModalWaitTimeout: parseInt(
      getEnv("SJS_SCRAPER_MODAL_WAIT_TIMEOUT", "500"),
      10,
    ),

    // Browser-Use Integration
    browserUseUrl: getEnv("SJS_BROWSER_USE_URL", "http://browser-use:8000"),
    browserUseTimeout: parseInt(
      getEnv("SJS_BROWSER_USE_TIMEOUT", "120000"),
      10,
    ),
    browserUseFallbackEnabled:
      getEnv("SJS_BROWSER_USE_FALLBACK_ENABLED", "true") === "true",

    // Scraper Method Selection
    scraperMethod: (getEnv(
      "SJS_SCRAPER_METHOD",
      "browser-use",
    ) as "browser-use" | "playwright"),
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
    "groqApiKey",
  ];

  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    errors.push(`Missing required configuration: ${missing.join(", ")}`);
  }

  // Validate positive numbers
  if (config.scraperMaxJobsPerSearch <= 0) {
    errors.push("scraperMaxJobsPerSearch must be > 0");
  }
  if (config.scraperMaxJobAge <= 0) {
    errors.push("scraperMaxJobAge must be > 0");
  }
  if (config.scraperConsecutiveClosedLimit <= 0) {
    errors.push("scraperConsecutiveClosedLimit must be > 0");
  }
  if (config.scraperPaginationMaxPages <= 0) {
    errors.push("scraperPaginationMaxPages must be > 0");
  }
  if (config.scraperInfiniteScrollMaxScrolls <= 0) {
    errors.push("scraperInfiniteScrollMaxScrolls must be > 0");
  }

  // Validate timeouts are positive
  if (config.scraperDefaultTimeout <= 0) {
    errors.push("scraperDefaultTimeout must be > 0");
  }
  if (config.scraperNetworkIdleTimeout <= 0) {
    errors.push("scraperNetworkIdleTimeout must be > 0");
  }
  if (config.scraperPageLoadTimeout <= 0) {
    errors.push("scraperPageLoadTimeout must be > 0");
  }
  if (config.scraperClickWaitTimeout <= 0) {
    errors.push("scraperClickWaitTimeout must be > 0");
  }
  if (config.scraperRateLimitDelay <= 0) {
    errors.push("scraperRateLimitDelay must be > 0");
  }
  if (config.scraperCaptchaCheckInterval <= 0) {
    errors.push("scraperCaptchaCheckInterval must be > 0");
  }
  if (config.scraperModalWaitTimeout <= 0) {
    errors.push("scraperModalWaitTimeout must be > 0");
  }
  if (config.browserUseTimeout <= 0) {
    errors.push("browserUseTimeout must be > 0");
  }

  // Validate scraper method
  if (!["browser-use", "playwright"].includes(config.scraperMethod)) {
    errors.push(
      `scraperMethod must be 'browser-use' or 'playwright', got '${config.scraperMethod}'`,
    );
  }

  // Validate scraper-specific requirements
  if (config.scraperMethod === "browser-use" && !config.browserUseUrl) {
    errors.push("browserUseUrl is required when using browser-use scraper");
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
