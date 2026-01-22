import { config } from "./config";
import { dbDirect } from "$lib/db";

export interface BrowserUseConfig {
  baseUrl: string;
  timeout: number;
  useVision: boolean;
}

export interface ExecuteTaskParams {
  task: string; // Natural language task description
  startUrl: string; // URL to start from
  maxTime?: number; // Optional max execution time in seconds
  useVision?: boolean; // Optional screenshot configuration
}

export interface ExecuteTaskResponse {
  result: any; // Whatever the agent returns
  execution_time_ms: number;
}

// Hybrid session parameters (Browser-Use launches Chrome, keeps it open)
export interface HybridSessionParams {
  task: string; // Natural language login task
  startUrl: string; // URL to start from (login page)
  cdpPort?: number; // Port for CDP (default 9222)
  maxTime?: number; // Max execution time in seconds
  useVision?: boolean;
  solveCaptcha?: boolean; // If true, Browser-Use attempts to solve CAPTCHAs (default: false)
}

// Hybrid session response
export interface HybridSessionResponse {
  login_success: boolean;
  captcha_needed?: boolean; // True if CAPTCHA needs manual solving via VNC
  verification_needed?: boolean; // True if 2FA/verification required
  verification_type?: string; // "email", "sms", "2fa", "code"
  verification_prompt?: string; // User-friendly prompt
  current_url: string;
  cdp_port: number;
  cdp_url?: string; // Cloud mode: WebSocket URL for Playwright CDP connection
  live_url?: string; // Cloud mode: URL to watch the browser session live
  execution_time_ms: number;
  error?: string;
}

// Browser-Use Cloud session
export interface CloudBrowserSession {
  id: string;
  status: "running" | "stopped" | "paused" | "error";
  cdpUrl: string;
  liveUrl: string;
  createdAt: string;
}

// Browser-Use Cloud task
export interface CloudTask {
  id: string;
  status: "running" | "finished" | "failed" | "stopped";
  output?: string;
  error?: string;
  createdAt: string;
  finishedAt?: string;
}

// Cloud API response for creating a browser session
interface CloudCreateBrowserResponse {
  id: string;
  status: string;
  cdpUrl: string;
  liveUrl: string;
  createdAt: string;
}

// Cloud API response for creating a task
interface CloudCreateTaskResponse {
  id: string;
  status: string;
  createdAt: string;
}

// Cloud API response for getting task status
interface CloudGetTaskResponse {
  id: string;
  status: "running" | "finished" | "failed" | "stopped";
  output?: string;
  error?: string;
  createdAt: string;
  finishedAt?: string;
}

// Verification code response
export interface VerifyCodeResponse {
  success: boolean; // Whether the code was accepted
  login_complete: boolean; // Whether login is now complete
  needs_new_code: boolean; // Whether code expired and needs resend
  captcha_needed?: boolean; // CAPTCHA appeared, user must solve manually via VNC
  current_url: string;
  execution_time_ms: number;
  error?: string;
}

// Resend code response
export interface ResendCodeResponse {
  success: boolean;
  execution_time_ms: number;
  error?: string;
}

// Job data structure expected from Browser-Use extraction
export interface JobData {
  title: string;
  job_description: string | null;
  company_description: string | null;
  job_poster: string | null;
  date_posted: string | Date | null; // Can be string from Browser-Use, Date after parsing
  location: string | null;
  remote: string | null;
  experience_level: string | null;
  job_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  skills: string[] | null;
  status: string | null;
  application_url?: string; // Optional, used as source URL
}

/**
 * Sanitize response object by removing screenshot data for logging
 */
function sanitizeForLogging(obj: any, maxDepth = 3, currentDepth = 0): any {
  if (currentDepth > maxDepth) return "[Max depth reached]";
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      sanitizeForLogging(item, maxDepth, currentDepth + 1)
    );
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip screenshot fields
    if (key === "screenshot" || key === "screenshots") {
      sanitized[key] = "[Screenshot data removed]";
      continue;
    }

    // Truncate very long strings (likely base64 encoded data)
    if (typeof value === "string" && value.length > 1000) {
      sanitized[key] = `[Long string truncated: ${value.length} chars]`;
      continue;
    }

    sanitized[key] = sanitizeForLogging(value, maxDepth, currentDepth + 1);
  }
  return sanitized;
}

export class BrowserUseClient {
  private config: BrowserUseConfig;
  private isCloudMode: boolean;
  private cloudApiKey?: string;
  private cloudProfileId?: string;
  private cloudTimeout: number; // minutes
  private cloudSessionId?: string; // Track active cloud session for cleanup

  private static readonly CLOUD_API_BASE = "https://api.browser-use.com/api/v1";

  constructor(customConfig?: Partial<BrowserUseConfig>) {
    // Use default config if not provided
    // baseUrl is hardcoded since it's always the browser-use Docker service
    this.config = {
      baseUrl: customConfig?.baseUrl ?? "http://browser-use:8000",
      timeout: customConfig?.timeout ?? config.browserUseTimeout,
      useVision: customConfig?.useVision ??
        config.browserUseVision,
    };

    // Cloud mode configuration
    this.isCloudMode = config.browserUseCloud;
    if (this.isCloudMode) {
      this.cloudApiKey = config.browserUseCloudApiKey;
      this.cloudProfileId = config.browserUseCloudProfileId;
      this.cloudTimeout = config.browserUseCloudTimeout;

      if (!this.cloudApiKey) {
        throw new Error(
          "Browser-Use Cloud mode enabled but SJS_LLM_API_KEY_BROWSER_USE not set",
        );
      }
      if (!this.cloudProfileId) {
        throw new Error(
          "Browser-Use Cloud mode enabled but SJS_BROWSER_USE_CLOUD_PROFILE_ID not set",
        );
      }

      console.log(
        `[BrowserUseClient] Initialized in CLOUD mode (profile: ${this.cloudProfileId}, timeout: ${this.cloudTimeout}min)`,
      );
    } else {
      this.cloudTimeout = 30; // Default, not used in local mode
      console.log(
        `[BrowserUseClient] Initialized in LOCAL mode, useVision: ${this.config.useVision}`,
      );
    }
  }

  /**
   * Fetch a prompt template from the database.
   * @param request The request identifier (e.g., "submit_verification_code_browser_use")
   * @returns Combined system_prompt + user_prompt as a single task string
   */
  private async fetchPromptTemplate(request: string): Promise<string> {
    const template = await dbDirect.ai_chat_prompts.findUnique({
      where: { request },
    });

    if (!template) {
      throw new Error(
        `Prompt template '${request}' not found in ai_chat_prompts`,
      );
    }

    // Combine system and user prompts (Browser-Use uses single task string)
    return `${template.system_prompt || ""}\n\n${template.user_prompt || ""}`
      .trim();
  }

  async executeTask(params: ExecuteTaskParams): Promise<ExecuteTaskResponse> {
    const useVision = params.useVision ??
      this.config.useVision;
    console.log(
      `[BrowserUseClient] Sending request with use_vision: ${useVision}`,
    );

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: params.task,
          start_url: params.startUrl,
          max_time: params.maxTime,
          use_vision: useVision,
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      });
    } catch (error) {
      // Network-level failure - the browser-use server likely crashed
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.error(`\n❌ Failed to communicate with browser-use server`);
      console.error(`   Error: ${errorMsg}`);
      console.error(
        `\n💡 The browser-use server likely crashed. Common causes:`,
      );
      console.error(
        `   - LLM API rate limit exceeded (e.g., Groq daily token limit)`,
      );
      console.error(
        `   - LLM context length exceeded (task accumulated too much history)`,
      );
      console.error(`   - Network timeout or server overload`);
      console.error(`\n📋 Check browser-use container logs for details:`);
      console.error(`   docker compose logs browser-use --tail=50\n`);

      throw new Error(
        `Browser-Use server connection failed: ${errorMsg}. Check 'docker compose logs browser-use' for LLM API errors.`,
      );
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `\n❌ Browser-Use API returned error: ${response.status} ${response.statusText}`,
      );
      if (errorBody) {
        console.error(`   Response: ${errorBody.substring(0, 500)}`);
      }
      throw new Error(
        `Browser-Use API error: ${response.status} ${response.statusText}`,
      );
    }

    return await response.json();
  }

  /**
   * Extract job data from a single job detail page using Browser-Use
   * @param jobUrl URL of the job posting to extract
   * @returns Structured job data
   */
  async extractSingleJob(jobUrl: string): Promise<JobData> {
    // Fetch prompt template from Directus
    const template = await dbDirect.ai_chat_prompts.findUnique({
      where: { request: "extract_job_data_browser_use" },
    });

    if (!template) {
      throw new Error(
        "Prompt template 'extract_job_data_browser_use' not found in ai_chat_prompts",
      );
    }

    // Combine system and user prompts for the Browser-Use task
    const task = `${template.system_prompt || ""}\n\n${
      template.user_prompt || ""
    }`.trim();

    // Execute the task
    const response = await this.executeTask({
      task,
      startUrl: jobUrl,
      maxTime: 60, // 1 minute max for single job
      useVision: this.config.useVision,
    });

    // Parse the JSON result
    try {
      // Check if Browser-Use returned an error/history object instead of job data
      if (typeof response.result === "object" && response.result !== null) {
        const resultObj = response.result as any;

        // If it has 'history' property, it means Browser-Use failed
        if (resultObj.history || resultObj.error) {
          // Check for rate limit errors
          const isRateLimit =
            JSON.stringify(resultObj).includes("Rate limit") ||
            JSON.stringify(resultObj).includes("rate limit") ||
            JSON.stringify(resultObj).includes("429");

          if (isRateLimit) {
            console.error("❌ Browser-Use hit LLM API rate limit");
            console.log(
              "💡 Tip: Check your LLM provider API key and rate limits",
            );
            console.log("Current provider:", config.llmProvider);
            throw new Error(
              "Browser-Use hit rate limit - check API key and provider limits",
            );
          }

          console.error("❌ Browser-Use failed to extract job data");
          console.log(
            "Error details:",
            JSON.stringify(sanitizeForLogging(resultObj), null, 2),
          );
          throw new Error("Browser-Use agent failed to extract job data");
        }

        // If it's already a valid job data object, return it
        if (resultObj.title || resultObj.job_description) {
          return resultObj as JobData;
        }
      }

      // Otherwise, try to parse as JSON string
      const resultStr = typeof response.result === "string"
        ? response.result
        : JSON.stringify(response.result);

      // Try to extract JSON from the result
      const jsonMatch = resultStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jobData = JSON.parse(jsonMatch[0]) as JobData;
        return jobData;
      } else {
        throw new Error("No JSON object found in response");
      }
    } catch (error) {
      console.error("❌ Failed to parse Browser-Use response:", error);
      console.log(
        "Raw response:",
        JSON.stringify(sanitizeForLogging(response.result), null, 2),
      );
      throw new Error("Browser-Use returned invalid or failed response");
    }
  }

  /**
   * Start a hybrid session: Browser-Use launches Chrome with CDP, performs login,
   * and keeps the browser open for Patchright to connect.
   *
   * In cloud mode: Uses Browser-Use Cloud API to create a session and run login task.
   * In local mode: Uses local Browser-Use server's /hybrid/start endpoint.
   *
   * @param params Hybrid session parameters
   * @returns Response with login_success, current_url, cdp_port (and cdp_url in cloud mode)
   */
  async startHybridSession(
    params: HybridSessionParams,
  ): Promise<HybridSessionResponse> {
    if (this.isCloudMode) {
      return this.startCloudHybridSession(params);
    }
    return this.startLocalHybridSession(params);
  }

  /**
   * Start hybrid session using Browser-Use Cloud.
   * Creates a cloud browser session with persistent profile, runs login task.
   */
  private async startCloudHybridSession(
    params: HybridSessionParams,
  ): Promise<HybridSessionResponse> {
    console.log(`\n🌐 Using Browser-Use Cloud`);
    const startTime = Date.now();

    // 1. Create cloud browser session with persistent profile
    const session = await this.createCloudBrowserSession();
    this.cloudSessionId = session.id;

    console.log(`📺 Live URL: ${session.liveUrl}`);
    console.log(`   (Open to monitor - CAPTCHA will be solved automatically)`);

    // 2. Run login task
    console.log(`⏳ Running login task...`);
    const task = await this.runCloudTask(session.id, params.task);

    // 3. Wait for task completion
    const completedTask = await this.waitForCloudTask(task.id);

    const executionTime = Date.now() - startTime;

    if (completedTask.status === "failed") {
      console.error(`❌ Cloud login task failed: ${completedTask.error}`);
      return {
        login_success: false,
        current_url: params.startUrl,
        cdp_port: 0,
        cdp_url: session.cdpUrl,
        live_url: session.liveUrl,
        execution_time_ms: executionTime,
        error: completedTask.error || "Cloud login task failed",
      };
    }

    console.log(`✅ Login completed in ${(executionTime / 1000).toFixed(1)}s`);
    console.log(`🔌 CDP URL: ${session.cdpUrl}`);

    return {
      login_success: true,
      current_url: params.startUrl,
      cdp_port: 0, // Not used in cloud mode
      cdp_url: session.cdpUrl,
      live_url: session.liveUrl,
      execution_time_ms: executionTime,
    };
  }

  /**
   * Create a cloud browser session with persistent profile.
   */
  private async createCloudBrowserSession(): Promise<CloudBrowserSession> {
    console.log(
      `[BrowserUseClient] Creating cloud session with profile: ${this.cloudProfileId}`,
    );

    const response = await fetch(
      `${BrowserUseClient.CLOUD_API_BASE}/browsers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.cloudApiKey!,
        },
        body: JSON.stringify({
          persistenceContextId: this.cloudProfileId,
          sessionTimeout: this.cloudTimeout * 60, // Convert minutes to seconds
        }),
        signal: AbortSignal.timeout(60000),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      if (response.status === 401) {
        throw new Error(
          "Browser-Use Cloud: Invalid API key (SJS_LLM_API_KEY_BROWSER_USE)",
        );
      }
      if (response.status === 429) {
        throw new Error(
          "Browser-Use Cloud: Rate limit exceeded. Try again later.",
        );
      }
      throw new Error(
        `Browser-Use Cloud: Failed to create session (${response.status}): ${errorBody}`,
      );
    }

    const data: CloudCreateBrowserResponse = await response.json();

    return {
      id: data.id,
      status: "running",
      cdpUrl: data.cdpUrl,
      liveUrl: data.liveUrl,
      createdAt: data.createdAt,
    };
  }

  /**
   * Run a task on a cloud browser session.
   */
  private async runCloudTask(
    sessionId: string,
    task: string,
  ): Promise<CloudTask> {
    console.log(
      `[BrowserUseClient] Running cloud task on session: ${sessionId}`,
    );

    const response = await fetch(`${BrowserUseClient.CLOUD_API_BASE}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.cloudApiKey!,
      },
      body: JSON.stringify({
        browserId: sessionId,
        task,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `Browser-Use Cloud: Failed to create task (${response.status}): ${errorBody}`,
      );
    }

    const data: CloudCreateTaskResponse = await response.json();

    return {
      id: data.id,
      status: "running",
      createdAt: data.createdAt,
    };
  }

  /**
   * Wait for a cloud task to complete by polling.
   */
  private async waitForCloudTask(
    taskId: string,
    pollIntervalMs: number = 2000,
    maxWaitMs: number = 300000, // 5 minutes
  ): Promise<CloudTask> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const response = await fetch(
        `${BrowserUseClient.CLOUD_API_BASE}/tasks/${taskId}`,
        {
          method: "GET",
          headers: {
            "x-api-key": this.cloudApiKey!,
          },
          signal: AbortSignal.timeout(30000),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `Browser-Use Cloud: Failed to get task status (${response.status}): ${errorBody}`,
        );
      }

      const data: CloudGetTaskResponse = await response.json();

      if (
        data.status === "finished" || data.status === "failed" ||
        data.status === "stopped"
      ) {
        return {
          id: data.id,
          status: data.status,
          output: data.output,
          error: data.error,
          createdAt: data.createdAt,
          finishedAt: data.finishedAt,
        };
      }

      // Still running, wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(
      `Browser-Use Cloud: Task timed out after ${maxWaitMs / 1000}s`,
    );
  }

  /**
   * Start hybrid session using local Browser-Use server.
   */
  private async startLocalHybridSession(
    params: HybridSessionParams,
  ): Promise<HybridSessionResponse> {
    const useVision = params.useVision ??
      this.config.useVision;
    console.log(
      `[BrowserUseClient] Starting local hybrid session, CDP port: ${
        params.cdpPort ?? 9222
      }`,
    );

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/hybrid/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: params.task,
          start_url: params.startUrl,
          cdp_port: params.cdpPort ?? 9222,
          max_time: params.maxTime,
          use_vision: useVision,
          solve_captcha: params.solveCaptcha ?? false,
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to start hybrid session: ${errorMsg}`);
      throw new Error(`Hybrid session failed: ${errorMsg}`);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `\n❌ Hybrid session API error: ${response.status} ${response.statusText}`,
      );
      if (errorBody) {
        console.error(`   Response: ${errorBody.substring(0, 500)}`);
      }
      throw new Error(
        `Hybrid session API error: ${response.status} ${response.statusText}`,
      );
    }

    const result: HybridSessionResponse = await response.json();

    console.log(
      `[BrowserUseClient] Hybrid session result: success=${result.login_success}, url=${result.current_url}, port=${result.cdp_port}`,
    );

    return result;
  }

  /**
   * Close the hybrid browser session.
   * Call this after Patchright has finished extracting jobs.
   *
   * In cloud mode: Stops the cloud browser session.
   * In local mode: Calls local Browser-Use server to close.
   */
  async closeHybridSession(): Promise<void> {
    if (this.isCloudMode) {
      return this.closeCloudSession();
    }
    return this.closeLocalSession();
  }

  /**
   * Close cloud browser session.
   */
  private async closeCloudSession(): Promise<void> {
    if (!this.cloudSessionId) {
      console.warn(`[BrowserUseClient] No cloud session to close`);
      return;
    }

    console.log(
      `[BrowserUseClient] Closing cloud session: ${this.cloudSessionId}`,
    );

    try {
      const response = await fetch(
        `${BrowserUseClient.CLOUD_API_BASE}/browsers/${this.cloudSessionId}/stop`,
        {
          method: "PUT",
          headers: {
            "x-api-key": this.cloudApiKey!,
          },
          signal: AbortSignal.timeout(10000),
        },
      );

      if (response.ok) {
        console.log(`[BrowserUseClient] Cloud session closed`);
      } else {
        console.warn(
          `[BrowserUseClient] Failed to close cloud session: ${response.status}`,
        );
      }
    } catch (error) {
      console.warn(`[BrowserUseClient] Error closing cloud session: ${error}`);
    } finally {
      this.cloudSessionId = undefined;
    }
  }

  /**
   * Close local hybrid browser session.
   */
  private async closeLocalSession(): Promise<void> {
    console.log(`[BrowserUseClient] Closing local hybrid session...`);

    try {
      const response = await fetch(`${this.config.baseUrl}/hybrid/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        console.log(`[BrowserUseClient] Local hybrid session closed`);
      } else {
        console.warn(
          `[BrowserUseClient] Failed to close local hybrid session: ${response.status}`,
        );
      }
    } catch (error) {
      console.warn(
        `[BrowserUseClient] Error closing local hybrid session: ${error}`,
      );
    }
  }

  /**
   * Submit a verification code to continue login.
   * Call this after startHybridSession returns verification_needed=true.
   * @param code The verification code to enter
   * @param cdpPort CDP port (default 9222)
   * @returns Response with success, login_complete, needs_new_code
   */
  async submitVerificationCode(
    code: string,
    cdpPort: number = 9222,
  ): Promise<VerifyCodeResponse> {
    console.log(`[BrowserUseClient] Submitting verification code...`);

    // Fetch and interpolate the prompt template
    let task: string;
    try {
      const taskTemplate = await this.fetchPromptTemplate(
        "submit_verification_code_browser_use",
      );
      task = taskTemplate.replace(/\{\{code\}\}/g, code);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to fetch prompt template: ${errorMsg}`);
      return {
        success: false,
        login_complete: false,
        needs_new_code: false,
        current_url: "",
        execution_time_ms: 0,
        error: `Failed to fetch prompt template: ${errorMsg}`,
      };
    }

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/hybrid/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          code,
          cdp_port: cdpPort,
          max_time: 60,
          use_vision: this.config.useVision,
        }),
        signal: AbortSignal.timeout(120000),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to submit verification code: ${errorMsg}`);
      return {
        success: false,
        login_complete: false,
        needs_new_code: false,
        current_url: "",
        execution_time_ms: 0,
        error: `Verification submission failed: ${errorMsg}`,
      };
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `\n❌ Verification API error: ${response.status} ${response.statusText}`,
      );
      if (errorBody) {
        console.error(`   Response: ${errorBody.substring(0, 500)}`);
      }
      return {
        success: false,
        login_complete: false,
        needs_new_code: false,
        current_url: "",
        execution_time_ms: 0,
        error:
          `Verification API error: ${response.status} ${response.statusText}`,
      };
    }

    const result: VerifyCodeResponse = await response.json();

    console.log(
      `[BrowserUseClient] Verification result: success=${result.success}, login_complete=${result.login_complete}, needs_new_code=${result.needs_new_code}, captcha_needed=${result.captcha_needed}`,
    );

    return result;
  }

  /**
   * Request a new verification code.
   * Call this when the verification code has expired.
   * @param cdpPort CDP port (default 9222)
   * @returns Response with success status
   */
  async resendVerificationCode(
    cdpPort: number = 9222,
  ): Promise<ResendCodeResponse> {
    console.log(`[BrowserUseClient] Requesting new verification code...`);

    // Fetch the prompt template (no interpolation needed)
    let task: string;
    try {
      task = await this.fetchPromptTemplate(
        "resend_verification_code_browser_use",
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to fetch prompt template: ${errorMsg}`);
      return {
        success: false,
        execution_time_ms: 0,
        error: `Failed to fetch prompt template: ${errorMsg}`,
      };
    }

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/hybrid/resend-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          cdp_port: cdpPort,
          max_time: 30,
          use_vision: this.config.useVision,
        }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to resend verification code: ${errorMsg}`);
      return {
        success: false,
        execution_time_ms: 0,
        error: `Resend code failed: ${errorMsg}`,
      };
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `\n❌ Resend code API error: ${response.status} ${response.statusText}`,
      );
      if (errorBody) {
        console.error(`   Response: ${errorBody.substring(0, 500)}`);
      }
      return {
        success: false,
        execution_time_ms: 0,
        error:
          `Resend code API error: ${response.status} ${response.statusText}`,
      };
    }

    const result: ResendCodeResponse = await response.json();

    console.log(
      `[BrowserUseClient] Resend code result: success=${result.success}`,
    );

    return result;
  }

  // =====================
  // Session Management Methods
  // =====================

  /**
   * Check if the persistent session is logged in for a platform.
   * @param checkUrl URL to navigate to (e.g., the job search page)
   * @param loginUrlPattern Pattern indicating login page (if URL contains this, not logged in)
   * @param cdpPort CDP port (default 9222)
   * @returns Session status with is_logged_in flag
   */
  async checkSession(
    checkUrl: string,
    loginUrlPattern: string,
    cdpPort: number = 9222,
  ): Promise<{
    session_exists: boolean;
    is_logged_in: boolean;
    current_url: string;
    cdp_port: number;
  }> {
    console.log(`[BrowserUseClient] Checking session for: ${checkUrl}`);

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/session/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          check_url: checkUrl,
          login_url_pattern: loginUrlPattern,
          cdp_port: cdpPort,
        }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to check session: ${errorMsg}`);
      return {
        session_exists: false,
        is_logged_in: false,
        current_url: "",
        cdp_port: cdpPort,
      };
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `\n❌ Session check API error: ${response.status} ${response.statusText}`,
      );
      if (errorBody) {
        console.error(`   Response: ${errorBody.substring(0, 500)}`);
      }
      return {
        session_exists: false,
        is_logged_in: false,
        current_url: "",
        cdp_port: cdpPort,
      };
    }

    const result = await response.json();
    console.log(
      `[BrowserUseClient] Session check: exists=${result.session_exists}, logged_in=${result.is_logged_in}`,
    );
    return result;
  }

  /**
   * Start browser with existing persistent session (no login attempt).
   * Use this to launch the browser for manual login.
   * @param startUrl URL to navigate to
   * @param cdpPort CDP port (default 9222)
   * @returns Session start response with VNC URL for manual intervention
   */
  async startSession(
    startUrl: string,
    cdpPort: number = 9222,
  ): Promise<{
    success: boolean;
    current_url: string;
    cdp_port: number;
    vnc_url: string;
  }> {
    console.log(`[BrowserUseClient] Starting session at: ${startUrl}`);

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_url: startUrl,
          cdp_port: cdpPort,
        }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Failed to start session: ${errorMsg}`);
      throw new Error(`Session start failed: ${errorMsg}`);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `\n❌ Session start API error: ${response.status} ${response.statusText}`,
      );
      if (errorBody) {
        console.error(`   Response: ${errorBody.substring(0, 500)}`);
      }
      throw new Error(
        `Session start API error: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();
    console.log(
      `[BrowserUseClient] Session started: ${result.current_url}, VNC: ${result.vnc_url}`,
    );
    return result;
  }

  /**
   * Wait for manual login completion by polling the current URL.
   * @param targetUrlPattern Pattern indicating successful login (e.g., "/jobs", "/feed")
   * @param cdpPort CDP port (default 9222)
   * @param timeoutSeconds Timeout in seconds (default 300 = 5 minutes)
   * @param pollIntervalSeconds Poll interval in seconds (default 5)
   * @returns Response with success flag and current URL
   */
  async waitForLogin(
    targetUrlPattern: string,
    cdpPort: number = 9222,
    timeoutSeconds: number = 300,
    pollIntervalSeconds: number = 5,
  ): Promise<{
    success: boolean;
    current_url: string;
    timed_out: boolean;
  }> {
    console.log(
      `[BrowserUseClient] Waiting for login (target pattern: ${targetUrlPattern})...`,
    );

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/session/wait`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_url_pattern: targetUrlPattern,
          cdp_port: cdpPort,
          timeout: timeoutSeconds,
          poll_interval: pollIntervalSeconds,
        }),
        signal: AbortSignal.timeout((timeoutSeconds + 30) * 1000), // Extra 30s buffer
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`\n❌ Wait for login failed: ${errorMsg}`);
      return {
        success: false,
        current_url: "",
        timed_out: true,
      };
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(
        `\n❌ Wait for login API error: ${response.status} ${response.statusText}`,
      );
      if (errorBody) {
        console.error(`   Response: ${errorBody.substring(0, 500)}`);
      }
      return {
        success: false,
        current_url: "",
        timed_out: false,
      };
    }

    const result = await response.json();
    console.log(
      `[BrowserUseClient] Wait for login result: success=${result.success}, timed_out=${result.timed_out}`,
    );
    return result;
  }
}
